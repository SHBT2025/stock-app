import React, { useState } from 'react';
import { StockTracker, Language } from '../types';
import { getTranslation } from '../translations';

interface AddTrackerFormProps {
  onAdd: (tracker: StockTracker) => void;
  lang: Language;
}

export const AddTrackerForm: React.FC<AddTrackerFormProps> = ({ onAdd, lang }) => {
  const [symbol, setSymbol] = useState('');
  const [startPrice, setStartPrice] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  const t = getTranslation(lang);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !startPrice || !targetPrice) return;

    const newTracker: StockTracker = {
      id: crypto.randomUUID(),
      symbol: symbol.toUpperCase(),
      startPrice: parseFloat(startPrice),
      targetPrice: parseFloat(targetPrice),
      currentPrice: null, // Initial state
      lastUpdated: null
    };

    onAdd(newTracker);
    
    // Reset
    setSymbol('');
    setStartPrice('');
    setTargetPrice('');
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full py-4 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 hover:text-primary hover:border-primary hover:bg-surface transition-all flex items-center justify-center gap-2 group"
      >
        <div className="bg-slate-800 p-2 rounded-full group-hover:bg-primary/20 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
        </div>
        <span className="font-semibold">{t.trackNew}</span>
      </button>
    );
  }

  return (
    <div className="bg-surface border border-slate-700 rounded-xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-white">{t.newTracker}</h3>
        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs uppercase font-bold text-slate-500 mb-1">{t.symbolLabel}</label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="e.g. BTC, AAPL, EUR/USD"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent uppercase"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase font-bold text-slate-500 mb-1">{t.startPrice}</label>
            <input
              type="number"
              step="any"
              value={startPrice}
              onChange={(e) => setStartPrice(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-xs uppercase font-bold text-slate-500 mb-1">{t.targetPrice}</label>
            <input
              type="number"
              step="any"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-success focus:border-transparent font-mono"
              required
            />
          </div>
        </div>
        
        <p className="text-xs text-slate-500 italic">
          {t.privacyNote}
        </p>

        <button
          type="submit"
          className="w-full bg-primary hover:bg-primary/90 text-slate-900 font-bold py-3 px-4 rounded-lg transition-colors flex justify-center items-center gap-2"
        >
           {t.startTracking}
        </button>
      </form>
    </div>
  );
};