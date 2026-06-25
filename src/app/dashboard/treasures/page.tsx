'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Destination = {
  name: string;
  cost: string;
  reason: string;
  icon: string;
};

export default function TreasuresPage() {
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [error, setError] = useState('');
  const [userKey, setUserKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setUserKey(savedKey);
    }
  }, []);

  const handleKeyChange = (key: string) => {
    setUserKey(key);
    localStorage.setItem('gemini_api_key', key);
  };

  const handleHunt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location || !budget) return;

    setLoading(true);
    setError('');
    setDestinations([]);

    try {
      const userApiKey = localStorage.getItem('gemini_api_key');
      
      const res = await fetch('/api/destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, budget, userApiKey })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to consult the charts.');
      }

      if (data.error) throw new Error(data.error);

      setDestinations(data.destinations || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div 
        className="fixed inset-0 z-0 opacity-40 pointer-events-none scale-110" 
        style={{ backgroundImage: "url('/image_2.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
      ></div>
      <div className="max-w-4xl mx-auto w-full p-4 md:p-8 relative z-10">
      {/* Header */}
      <div className="py-8 border-b border-outline-variant/30 mb-8">
        <Link
          href="/dashboard"
          className="self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-outline-variant text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-all shadow-sm group mb-6"
        >
          <span className="material-symbols-outlined text-[16px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
          Return to Deck
        </Link>
        <p className="font-mono text-xs text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2 font-bold">
          <span className="material-symbols-outlined text-sm">diamond</span>
          AI Navigation
        </p>
        <h2 className="font-display text-4xl md:text-5xl font-bold text-amber-500 tracking-tight">Treasures to Explore</h2>
        <p className="font-body-md text-on-surface-variant mt-2">
          Consult the magical compass! Enter your current port and your available plunder, and our AI navigator will reveal the best voyages you can afford.
        </p>
      </div>

      <div className="bg-surface-container-high border-2 border-dashed border-amber-600/30 rounded-xl p-6 md:p-8 shadow-inner mb-8">
        <form onSubmit={handleHunt} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-bold text-primary mb-1 uppercase tracking-widest font-mono">Current Port</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">location_on</span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Mumbai, India"
                className="w-full bg-background border border-outline-variant rounded-lg pl-10 pr-4 py-3 text-on-surface focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                required
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-bold text-primary mb-1 uppercase tracking-widest font-mono">Available Plunder (Rs)</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">payments</span>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full bg-background border border-outline-variant rounded-lg pl-10 pr-4 py-3 text-on-surface focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                required
                min="1000"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading || !location || !budget}
              className="w-full md:w-auto bg-gradient-to-r from-amber-500 to-yellow-600 text-black font-bold uppercase tracking-widest px-8 py-3 rounded-lg shadow-md hover:from-amber-400 hover:to-yellow-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin">refresh</span>
              ) : (
                <span className="material-symbols-outlined">explore</span>
              )}
              {loading ? 'Consulting Charts...' : 'Hunt for Treasure'}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-dashed border-amber-600/30 flex justify-end">
          <div className="w-full md:w-1/2 lg:w-1/3">
            <div className="relative group inline-block w-full">
              <button 
                type="button"
                onClick={() => setShowKeyInput(!showKeyInput)}
                className="text-xs font-mono text-amber-600 hover:text-amber-500 flex items-center gap-1 w-full justify-end cursor-help"
              >
                <span className="material-symbols-outlined text-[14px]">key</span>
                {showKeyInput ? 'Hide AI Key Settings' : 'Bring Your Own AI Key'}
              </button>
              
              {/* Tooltip Help Guide */}
              {!showKeyInput && (
                <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-surface-container-highest text-on-surface text-xs rounded-lg border border-outline-variant shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 pointer-events-none">
                  <p className="font-bold mb-1 text-primary">Need a Gemini API Key?</p>
                  <p className="text-on-surface-variant">
                    1. Go to Google AI Studio<br/>
                    2. Sign in with your Google account<br/>
                    3. Click "Get API Key"<br/>
                    4. Create and copy your free key!<br/>
                    <br/>
                    Without a key, you'll see a mock treasure map.
                  </p>
                </div>
              )}
            </div>
            
            {showKeyInput && (
              <div className="mt-3 animate-in slide-in-from-top-2">
                <input
                  type="password"
                  value={userKey}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  placeholder="Enter Gemini API Key..."
                  className="w-full bg-background border border-outline-variant rounded-lg px-4 py-2 text-sm text-on-surface focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
                />
                <p className="text-[10px] text-on-surface-variant mt-1 text-right">
                  Your key is saved locally in your browser.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-error-container text-on-error-container p-4 rounded-lg mb-8 border border-error">
          <p className="flex items-center gap-2">
            <span className="material-symbols-outlined">warning</span>
            {error}
          </p>
        </div>
      )}

      {destinations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {destinations.map((dest, i) => (
            <div key={i} className="bg-surface border border-outline-variant rounded-xl p-6 shadow-md hover:border-amber-500 hover:shadow-lg transition-all group flex flex-col h-full relative overflow-hidden">
              {/* Decorative top corner */}
              <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-bl-full -z-0"></div>
              
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full flex items-center justify-center mb-4 z-10">
                <span className="material-symbols-outlined text-2xl">{dest.icon || 'location_on'}</span>
              </div>
              
              <h3 className="font-display text-xl font-bold text-primary mb-1 z-10">{dest.name}</h3>
              <p className="font-mono text-sm font-bold text-secondary mb-4 z-10">{dest.cost}</p>
              
              <p className="font-body text-on-surface-variant text-sm flex-1 z-10 leading-relaxed">
                {dest.reason}
              </p>
              
              <div className="mt-6 pt-4 border-t border-outline-variant/30 flex justify-between items-center z-10">
                <span className="text-xs uppercase tracking-widest font-mono text-on-surface-variant">Recommendation #{i + 1}</span>
                <span className="material-symbols-outlined text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward</span>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
