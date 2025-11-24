export interface StockTracker {
  id: string;
  symbol: string;
  companyName?: string; // Added company name
  startPrice: number;
  targetPrice: number;
  currentPrice: number | null;
  lastUpdated: number | null;
  sourceUrl?: string; // For grounding attribution
  sourceTitle?: string;
  isCompleted?: boolean; // Status flag
  errorMessage?: string; // Track fetch errors
}

export interface PriceUpdateResult {
  symbol: string;
  price: number;
  companyName?: string; // Added company name
  sourceUrl?: string;
  sourceTitle?: string;
}

export enum SortOption {
  ADDED_DESC = 'Newest',
  PROGRESS_DESC = 'Closest to Target',
  PROGRESS_ASC = 'Furthest from Target',
}

export type Language = 'en' | 'zh' | 'ja';