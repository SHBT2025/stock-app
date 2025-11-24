import React from 'react';
import { StockTracker, Language } from '../types';
import { getTranslation } from '../translations';

interface StockCardProps {
  stock: StockTracker;
  onDelete: (id: string) => void;
  onToggleComplete: (id: string) => void;
  lang: Language;
}

export const StockCard: React.FC<StockCardProps> = ({ stock, onDelete, onToggleComplete, lang }) => {
  const { symbol, companyName, startPrice, targetPrice, currentPrice, lastUpdated, sourceUrl, sourceTitle, isCompleted, errorMessage } = stock;
  const t = getTranslation(lang);

  // Calculate Progress
  let progress = 0;
  
  if (currentPrice !== null) {
    const totalDistance = targetPrice - startPrice;
    const coveredDistance = currentPrice - startPrice;
    
    // Avoid division by zero
    if (totalDistance !== 0) {
      progress = (coveredDistance / totalDistance) * 100;
    }
  }

  // Visual clamping for the bar
  const barWidth = Math.min(Math.max(progress, 0), 100);
  
  // --- COLOR LOGIC ---
  const isBullishStrategy = targetPrice >= startPrice;
  const isAsianLocale = lang === 'zh' || lang === 'ja';

  let primaryColorClass = "";
  let progressBarClass = "";
  
  if (isBullishStrategy) {
    if (isAsianLocale) {
        primaryColorClass = "text-red-400"; 
        progressBarClass = "bg-gradient-to-r from-orange-400 to-red-500";
    } else {
        primaryColorClass = "text-emerald-400";
        progressBarClass = "bg-gradient-to-r from-teal-400 to-emerald-500";
    }
  } else {
    if (isAsianLocale) {
        primaryColorClass = "text-emerald-400"; 
        progressBarClass = "bg-gradient-to-r from-teal-400 to-emerald-500";
    } else {
        primaryColorClass = "text-red-400"; 
        progressBarClass = "bg-gradient-to-r from-orange-400 to-red-500";
    }
  }

  const isGoalHit = progress >= 100;

  // Modifiers for Completed State
  const containerOpacity = isCompleted ? "opacity-60 grayscale-[0.8] hover:grayscale-0 hover:opacity-100" : "";
  const containerBg = isCompleted ? "bg-slate-800/50 border-slate-700/50" : "bg-surface border-slate-700";

  return (
    <div className={`relative group ${containerBg} border rounded-xl p-5 shadow-lg transition-all duration-300 overflow-hidden ${isGoalHit && !isCompleted ? 'ring-1 ring-white/20' : ''} ${containerOpacity}`}>
      
      {/* Background Pulse Animation if Hit Target and Active */}
      {isGoalHit && !isCompleted && !errorMessage && (
        <div className={`absolute inset-0 opacity-10 animate-pulse pointer-events-none ${isAsianLocale && isBullishStrategy ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
      )}

      <div className="flex justify-between items-start mb-4 relative z-10 gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex flex-wrap items-center gap-2">
            <span className="truncate">{symbol.toUpperCase()}</span>
            {errorMessage ? (
               <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/20">
                 Error
               </span>
            ) : (
                <>
                {isGoalHit && !isCompleted && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase text-slate-900 ${isAsianLocale && isBullishStrategy ? 'bg-red-400' : 'bg-emerald-400'}`}>
                    {t.goalHit}
                </span>
                )}
                {isCompleted && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-slate-600 text-slate-300">
                    {t.complete}
                </span>
                )}
                </>
            )}
          </h3>
          {companyName && (
            <p className="text-sm text-slate-400 font-medium truncate">
              {companyName}
            </p>
          )}
          <div className="text-xs text-slate-500 mt-2 flex flex-col gap-0.5">
            <span>{t.start}: <span className="text-slate-600">{t.hidden}</span></span>
            <span>{t.target}: <span className="text-slate-600">{t.hidden}</span></span>
          </div>
        </div>
        
        <div className="text-right shrink-0">
           {errorMessage ? (
             <div className="text-red-400 text-xs font-bold uppercase tracking-wider bg-red-900/20 px-2 py-1 rounded">
               Invalid<br/>Symbol
             </div>
           ) : currentPrice !== null ? (
             <div className={`font-mono font-bold leading-none tracking-tighter ${isCompleted ? 'text-slate-400' : primaryColorClass} text-2xl sm:text-3xl`}>
               {progress.toFixed(2)}%
             </div>
           ) : (
             <div className="text-slate-500 text-sm animate-pulse">{t.syncing}</div>
           )}
           {!errorMessage && <div className="text-xs text-slate-500 mt-1">{t.progress}</div>}
        </div>
      </div>

      {/* Progress Bar Container */}
      <div className="relative h-4 bg-slate-900 rounded-full overflow-hidden mb-2 shadow-inner border border-slate-700/50 z-10">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ease-out ${isCompleted ? 'bg-slate-500' : (errorMessage ? 'bg-red-900/30' : progressBarClass)}`}
          style={{ width: errorMessage ? '100%' : `${barWidth}%`, opacity: errorMessage ? 0.5 : (progress < 0 ? 0.3 : 1) }}
        ></div>
        
        {errorMessage && (
             <div className="absolute left-0 top-0 bottom-0 flex items-center justify-center w-full">
             <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider">
               {errorMessage}
             </span>
           </div>
        )}

        {!errorMessage && progress < 0 && (
           <div className="absolute left-0 top-0 bottom-0 flex items-center justify-center w-full">
             <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
               {t.drifting}
             </span>
           </div>
        )}
      </div>

      <div className="flex justify-between items-end mt-4 relative z-20">
        <div className="text-xs text-slate-500 max-w-[60%]">
          {lastUpdated ? (
            <>
              Updated {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {sourceUrl && (
                <div className="mt-1 truncate">
                  via <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{sourceTitle || t.source}</a>
                </div>
              )}
            </>
          ) : (
            <span>{errorMessage ? 'Update failed' : t.waiting}</span>
          )}
        </div>
        
        {/* Action Buttons - High Z-Index + Isolate to prevent overlapping issues */}
        <div className="flex gap-2 relative z-50 isolate">
            <button 
                onClick={(e) => { 
                  e.preventDefault();
                  e.stopPropagation(); 
                  onToggleComplete(stock.id); 
                }}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                    isCompleted 
                    ? 'text-slate-500 hover:text-primary hover:bg-primary/10' 
                    : 'text-slate-500 hover:text-success hover:bg-success/10'
                } ${errorMessage ? 'opacity-30 cursor-not-allowed' : ''}`}
                title={isCompleted ? t.restore : t.complete}
                disabled={!!errorMessage}
            >
                {isCompleted ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                )}
            </button>

            <button 
              onClick={(e) => { 
                e.preventDefault();
                e.stopPropagation(); 
                onDelete(stock.id); 
              }}
              className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 p-2 rounded-lg transition-colors cursor-pointer group-hover/btn:scale-110 active:scale-95"
              title={t.delete}
            >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            </button>
        </div>
      </div>
    </div>
  );
};