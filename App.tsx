import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AddTrackerForm } from './components/AddTrackerForm';
import { StockCard } from './components/StockCard';
import { StockTracker, PriceUpdateResult, SortOption, Language } from './types';
import { fetchStockPrices } from './services/gemini';
import { getTranslation } from './translations';

const App: React.FC = () => {
  const [stocks, setStocks] = useState<StockTracker[]>(() => {
    const saved = localStorage.getItem('stealth_stocks');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>(SortOption.ADDED_DESC);
  const [language, setLanguage] = useState<Language>('zh'); 
  
  // API Key & Settings State
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('stealth_gemini_key') || '');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Editable Title State
  const [customTitle, setCustomTitle] = useState(() => localStorage.getItem('stealth_app_title') || '');
  const [customSubtitle, setCustomSubtitle] = useState(() => localStorage.getItem('stealth_app_subtitle') || '');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = getTranslation(language);

  // Persist State
  useEffect(() => {
    localStorage.setItem('stealth_stocks', JSON.stringify(stocks));
  }, [stocks]);

  useEffect(() => {
    localStorage.setItem('stealth_app_title', customTitle);
  }, [customTitle]);

  useEffect(() => {
    localStorage.setItem('stealth_app_subtitle', customSubtitle);
  }, [customSubtitle]);

  // Persist API Key securely
  const handleSaveApiKey = (key: string) => {
      setApiKey(key);
      localStorage.setItem('stealth_gemini_key', key);
  };

  const handleAddStock = (newStock: StockTracker) => {
    setStocks(prev => [newStock, ...prev]);
    // Trigger immediate refresh for the new stock
    refreshPrices([newStock]);
  };

  const handleDeleteStock = (id: string) => {
    // Immediate delete without confirmation to prevent "stuck" items
    setStocks(prev => prev.filter(s => s.id !== id));
  };

  const handleToggleComplete = (id: string) => {
    setStocks(prev => prev.map(s => {
        if (s.id === id) {
            return { ...s, isCompleted: !s.isCompleted };
        }
        return s;
    }));
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(stocks, null, 2);
    const blob = new Blob([dataStr], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stealth_stocks_backup_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content);
        
        if (Array.isArray(parsedData)) {
            // Simple validation: check if items look like stock trackers
            const isValid = parsedData.every(item => item.id && item.symbol && item.startPrice !== undefined);
            if (isValid) {
                setStocks(parsedData);
                alert(t.importSuccess);
            } else {
                alert(t.importError);
            }
        } else {
            alert(t.importError);
        }
      } catch (err) {
        console.error("Import error:", err);
        alert(t.importError);
      }
      // Reset input so same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const refreshPrices = useCallback(async (subset?: StockTracker[]) => {
    if (!apiKey) {
        setError(t.missingKey);
        setIsSettingsOpen(true);
        return;
    }

    // If specific subset passed, use it. Otherwise refresh all incomplete items.
    const targets = subset || stocks.filter(s => !s.isCompleted);
    
    if (targets.length === 0) return;

    setIsLoading(true);
    setError(null);

    const symbols: string[] = Array.from(new Set(targets.map(s => s.symbol)));

    try {
      const results: PriceUpdateResult[] = await fetchStockPrices(symbols, apiKey);
      
      setStocks(currentStocks => {
        return currentStocks.map(stock => {
          // Check if this stock was part of the requested update
          if (!symbols.includes(stock.symbol)) return stock;

          const update = results.find(r => r.symbol === stock.symbol);
          
          if (update && update.price > 0) {
            // Successful update
            return {
              ...stock,
              currentPrice: update.price,
              companyName: update.companyName || stock.companyName,
              lastUpdated: Date.now(),
              sourceUrl: update.sourceUrl,
              sourceTitle: update.sourceTitle,
              errorMessage: undefined // Clear previous errors
            };
          } else {
            // Failed update for this specific symbol
            // CRITICAL FIX: Update lastUpdated anyway so we don't retry endlessly in a loop
            // And set an error message
            return {
              ...stock,
              lastUpdated: Date.now(),
              errorMessage: "Symbol not found or data unavailable"
            };
          }
        });
      });
    } catch (err) {
      console.error(err);
      setError(t.errorUpdate);
      
      // Even on global error, update the stocks that tried to update with an error message
      // This allows the user to see which ones failed and delete them if they are invalid
      setStocks(currentStocks => currentStocks.map(stock => {
         if (symbols.includes(stock.symbol)) {
             return { 
                 ...stock, 
                 lastUpdated: Date.now(),
                 errorMessage: "Update failed" 
            };
         }
         return stock;
      }));

    } finally {
      setIsLoading(false);
    }
  }, [stocks, apiKey, t.errorUpdate, t.missingKey]);

  useEffect(() => {
    // Only auto-refresh active stocks if we have an API key
    if (!apiKey) return;

    const activeStocks = stocks.filter(s => !s.isCompleted);
    
    // Check if update is needed (never updated OR older than 1 hour)
    // AND check that we haven't recently errored out to avoid spamming bad symbols
    const needsUpdate = activeStocks.some(s => {
        const isStale = s.lastUpdated === null || (Date.now() - (s.lastUpdated || 0) > 3600000);
        return isStale; 
    });

    if (needsUpdate && activeStocks.length > 0) {
        // Filter only those that strictly need update to avoid re-fetching fresh data
        const toUpdate = activeStocks.filter(s => s.lastUpdated === null || (Date.now() - (s.lastUpdated || 0) > 3600000));
        refreshPrices(toUpdate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]); // Added apiKey dependency

  // Sorting Logic
  const getSortedStocks = (list: StockTracker[]) => {
      return [...list].sort((a, b) => {
        if (sortBy === SortOption.ADDED_DESC) return 0; // Natural order (newest first in state)
        
        const getProgress = (s: StockTracker) => {
            if (s.currentPrice === null) return -9999;
            const total = s.targetPrice - s.startPrice;
            if (total === 0) return 0;
            return ((s.currentPrice - s.startPrice) / total) * 100;
        };

        const pA = getProgress(a);
        const pB = getProgress(b);

        if (sortBy === SortOption.PROGRESS_DESC) return pB - pA;
        if (sortBy === SortOption.PROGRESS_ASC) return pA - pB;
        return 0;
      });
  };

  const activeStocks = getSortedStocks(stocks.filter(s => !s.isCompleted));
  const completedStocks = getSortedStocks(stocks.filter(s => s.isCompleted));

  return (
    <div className="min-h-screen p-6 md:p-12 max-w-5xl mx-auto">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImportFile} 
        accept=".txt,.json" 
        className="hidden" 
      />

      {/* API Key Modal / Settings Panel */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
            <div className="bg-surface border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl relative">
                 <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                 </button>
                 <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {t.settings}
                 </h2>
                 
                 <div className="space-y-4">
                     <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                            {t.apiKeyLabel}
                        </label>
                        <input 
                            type="password" 
                            value={apiKey}
                            onChange={(e) => handleSaveApiKey(e.target.value)}
                            placeholder={t.apiKeyPlaceholder}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                        />
                     </div>
                     
                     <div className="bg-slate-800/50 p-3 rounded-lg text-xs text-slate-400 leading-relaxed">
                         {t.apiKeyHelp}
                     </div>

                     <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-primary hover:text-primary/80 text-sm font-medium"
                     >
                        {t.getKey} &rarr;
                     </a>

                     <button 
                        onClick={() => setIsSettingsOpen(false)}
                        className="w-full bg-primary text-slate-900 font-bold py-3 rounded-lg hover:bg-primary/90 transition-colors"
                     >
                        {t.save}
                     </button>
                 </div>
            </div>
        </div>
      )}

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div className="w-full md:w-auto">
          {/* Editable Title */}
          <input 
            type="text"
            value={customTitle || (customTitle === '' ? t.appTitle : '')}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder={t.appTitle}
            className="w-full bg-transparent text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary mb-2 focus:outline-none focus:ring-2 focus:ring-slate-700/50 rounded-lg -ml-2 pl-2"
          />
          {/* Editable Subtitle */}
          <input 
            type="text"
            value={customSubtitle || (customSubtitle === '' ? t.appSubtitle : '')}
            onChange={(e) => setCustomSubtitle(e.target.value)}
            placeholder={t.appSubtitle}
            className="w-full bg-transparent text-slate-400 text-sm max-w-lg focus:outline-none focus:ring-2 focus:ring-slate-700/50 rounded-lg -ml-2 pl-2"
          />
        </div>

        <div className="flex flex-col items-end gap-3 w-full md:w-auto shrink-0">
            <div className="flex flex-wrap justify-end items-center gap-2">
                 
                 {/* Settings Button */}
                 <button 
                   onClick={() => setIsSettingsOpen(true)}
                   className={`bg-surface border border-slate-700 hover:bg-slate-700 py-1.5 px-3 rounded-lg text-xs transition-colors flex items-center gap-1 ${!apiKey ? 'animate-pulse border-red-500 text-red-400' : 'text-slate-300'}`}
                   title={t.settings}
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {t.settings}
                    {!apiKey && <span className="w-2 h-2 rounded-full bg-red-500 ml-1"></span>}
                 </button>

                 {/* Language Selector */}
                <div className="relative group">
                    <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as Language)}
                        className="appearance-none bg-surface border border-slate-700 text-slate-300 py-1.5 pl-3 pr-7 rounded-lg text-xs focus:outline-none focus:border-primary cursor-pointer hover:bg-slate-800 transition-colors uppercase"
                    >
                        <option value="en">EN</option>
                        <option value="zh">中文</option>
                        <option value="ja">日本語</option>
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                         </svg>
                    </div>
                </div>

                <div className="relative group">
                    <select 
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="appearance-none bg-surface border border-slate-700 text-slate-300 py-1.5 pl-3 pr-8 rounded-lg text-xs focus:outline-none focus:border-primary cursor-pointer hover:bg-slate-800 transition-colors"
                    >
                        <option value={SortOption.ADDED_DESC}>{t.sortRecent}</option>
                        <option value={SortOption.PROGRESS_DESC}>{t.sortClosest}</option>
                        <option value={SortOption.PROGRESS_ASC}>{t.sortFurthest}</option>
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>

                {/* Import/Export Buttons */}
                <button 
                  onClick={handleExport}
                  className="bg-surface border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 py-1.5 px-3 rounded-lg text-xs transition-colors"
                  title={t.exportData}
                >
                  {t.exportData}
                </button>
                <button 
                  onClick={handleImportClick}
                  className="bg-surface border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 py-1.5 px-3 rounded-lg text-xs transition-colors"
                  title={t.importData}
                >
                  {t.importData}
                </button>
            </div>

            <button 
                onClick={() => refreshPrices()}
                disabled={isLoading || stocks.length === 0}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-md ${
                    isLoading 
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                    : 'bg-secondary/10 text-secondary hover:bg-secondary/20 border border-secondary/20'
                }`}
            >
                <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isLoading ? t.syncing : t.refreshAll}
            </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 bg-red-400/10 border border-red-400/20 text-red-400 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
             {error}
             {!apiKey && (
                 <button onClick={() => setIsSettingsOpen(true)} className="ml-2 underline hover:text-white font-bold">
                     {t.settings}
                 </button>
             )}
          </div>
        </div>
      )}

      {/* Active Assets Section */}
      <div className="mb-4 flex items-center gap-2 text-slate-400 text-sm font-bold uppercase tracking-wider">
        <span className="w-2 h-2 rounded-full bg-primary"></span>
        {t.activeAssets}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <div className="col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-1">
             <AddTrackerForm onAdd={handleAddStock} lang={language} />
        </div>
        
        {activeStocks.map(stock => (
          <StockCard 
            key={stock.id} 
            stock={stock} 
            onDelete={handleDeleteStock}
            onToggleComplete={handleToggleComplete}
            lang={language}
          />
        ))}

        {stocks.length === 0 && (
            <div className="col-span-1 md:col-span-2 lg:col-span-2 flex flex-col items-center justify-center p-12 text-slate-600 border border-dashed border-slate-800 rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-lg font-medium">{t.noAssets}</p>
                <p className="text-sm">{t.addAssetHint}</p>
            </div>
        )}
      </div>

      {/* Completed/History Section */}
      {completedStocks.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
             <div className="mb-4 mt-8 flex items-center gap-2 text-slate-500 text-sm font-bold uppercase tracking-wider border-t border-slate-800 pt-8">
                <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                {t.history} ({completedStocks.length})
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-75">
                {completedStocks.map(stock => (
                <StockCard 
                    key={stock.id} 
                    stock={stock} 
                    onDelete={handleDeleteStock}
                    onToggleComplete={handleToggleComplete}
                    lang={language}
                />
                ))}
            </div>
        </div>
      )}
      
      <div className="mt-12 text-center text-slate-600 text-xs">
          <p>{t.poweredBy}</p>
      </div>
    </div>
  );
};

export default App;