import { GoogleGenAI } from "@google/genai";
import { PriceUpdateResult } from "../types";

// Initialize Gemini Client
// Note: process.env.API_KEY is assumed to be available as per instructions.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to escape special regex characters to prevent crashes on invalid user input
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const fetchStockPrices = async (symbols: string[]): Promise<PriceUpdateResult[]> => {
  if (symbols.length === 0) return [];

  const prompt = `
    Find the current real-time stock price and the short company name for the following symbols: ${symbols.join(', ')}.
    
    CRITICAL OUTPUT RULES:
    1. You MUST return the data as a strictly valid JSON object.
    2. The keys must be the exact stock symbols provided.
    3. The values must be an object containing "price" (number) and "name" (string).
    4. "name" should be the company name or asset name (e.g., "Apple Inc." or "Bitcoin").
    5. Do not include markdown formatting like \`\`\`json.
    6. Example format: { "AAPL": { "price": 150.25, "name": "Apple Inc." }, "GOOGL": { "price": 2750.50, "name": "Alphabet Inc." } }
  `;

  try {
    // Create a timeout promise to prevent hanging indefinitely
    const timeout = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("Request timed out")), 20000)
    );

    const apiCall = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    // Race the API call against the timeout
    const response = await Promise.race([apiCall, timeout]);

    // @ts-ignore - The response type intersection in the race might confuse TS
    const text = response.text || "";
    
    // Clean up potential markdown code blocks
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let data: Record<string, { price: number, name: string }> = {};
    try {
      data = JSON.parse(cleanText);
    } catch (e) {
      console.warn("Failed to parse Gemini response as JSON, falling back to Regex extraction.", e);
      // Fallback: simple regex extraction if JSON parse fails
      symbols.forEach(sym => {
          try {
            // Safely create regex even if sym has invalid characters like '[' or '('
            const escapedSym = escapeRegExp(sym);
            const priceRegex = new RegExp(`"${escapedSym}"\\s*:\\s*{[^}]*"price"\\s*:\\s*([0-9.]+)[^}]*}`, 'i');
            const match = cleanText.match(priceRegex);
            
            // Also try to find name
            const nameRegex = new RegExp(`"${escapedSym}"\\s*:\\s*{[^}]*"name"\\s*:\\s*"([^"]+)"`, 'i');
            const nameMatch = cleanText.match(nameRegex);
            
            if (match) {
                const name = nameMatch ? nameMatch[1] : sym;
                data[sym] = { price: parseFloat(match[1]), name: name };
            }
          } catch (regexError) {
            console.error(`Error processing regex for symbol ${sym}`, regexError);
          }
      });
    }

    // Extract grounding source
    // @ts-ignore
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    let defaultSourceUrl: string | undefined;
    let defaultSourceTitle: string | undefined;

    // Try to find a relevant source from the first chunk that has web data
    // @ts-ignore
    const firstWebChunk = groundingChunks.find(c => c.web?.uri);
    if (firstWebChunk && firstWebChunk.web) {
      defaultSourceUrl = firstWebChunk.web.uri;
      defaultSourceTitle = firstWebChunk.web.title;
    }

    const results: PriceUpdateResult[] = symbols.map(sym => {
      const entry = data[sym];
      return {
        symbol: sym,
        price: entry?.price || 0, // 0 indicates failure to fetch specific symbol
        companyName: entry?.name || sym,
        sourceUrl: defaultSourceUrl,
        sourceTitle: defaultSourceTitle,
      };
    });

    return results;

  } catch (error) {
    console.error("Error fetching stock prices via Gemini:", error);
    throw error;
  }
};