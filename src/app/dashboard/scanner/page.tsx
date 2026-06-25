'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ScannerPage() {
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // User Settings
  const [userApiKey, setUserApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Parsed Results
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');

  // Currency State
  const [currency, setCurrency] = useState('INR');
  const [isConverting, setIsConverting] = useState(false);

  // Submission State
  const [groups, setGroups] = useState<{ id: string, group_name: string }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchUserAndGroups = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);

      const { data } = await supabase
        .from('shared_groups')
        .select('id, group_name, status')
        .neq('status', 'finished')
        .order('created_at', { ascending: false });

      if (data) setGroups(data);

      // Load saved API key
      const savedKey = localStorage.getItem('gemini_api_key');
      if (savedKey) setUserApiKey(savedKey);
    };
    fetchUserAndGroups();
  }, []);

  const saveApiKey = (key: string) => {
    setUserApiKey(key);
    localStorage.setItem('gemini_api_key', key);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleScan = async () => {
    if (!image) return;
    setLoading(true);
    setErrorMsg('');

    try {
      // Convert to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          // Extract just the base64 data, removing the data:image/jpeg;base64, prefix
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
      });
      reader.readAsDataURL(image);
      const imageBase64 = await base64Promise;

      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType: image.type,
          userApiKey: userApiKey || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to scan');
      }

      const data = await res.json();
      setAmount(data.amount ? data.amount.toString() : '');
      setDescription(data.description || '');
      setCategory(data.category || 'other');

    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with the Quartermaster AI.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !userId) return;
    setIsSubmitting(true);
    setIsConverting(true);

    try {
      let finalAmountInr = parseFloat(amount);
      let exchangeRate = 1.0;

      if (currency !== 'INR') {
        const res = await fetch(`https://open.er-api.com/v6/latest/${currency}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.rates && data.rates.INR) {
            exchangeRate = data.rates.INR;
            finalAmountInr = finalAmountInr * exchangeRate;
          }
        }
      }

      setIsConverting(false);
      const newId = crypto.randomUUID();

      if (selectedGroupId) {
        await supabase.from('group_expenses').insert([{
          id: newId,
          group_id: selectedGroupId,
          description,
          amount: finalAmountInr,
          original_currency: currency,
          exchange_rate: exchangeRate,
          category,
          paid_by: userId
        }]);
      } else {
        await supabase.from('personal_expenses').insert([{
          id: newId,
          user_id: userId,
          description,
          amount: finalAmountInr,
          category
        }]);
      }

      alert('✅ Successfully logged to the ledger!');
      router.push('/dashboard/expenses');
    } catch (error) {
      alert('Failed to save.');
    } finally {
      setIsSubmitting(false);
      setIsConverting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="fixed inset-0 z-0 opacity-60 pointer-events-none scale-110"
        style={{ backgroundImage: "url('/image_3.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
      ></div>
      <div className="max-w-4xl mx-auto w-full p-4 md:p-8 relative z-10">
        <div className="py-8 border-b border-outline-variant/30 mb-8 flex justify-between items-start">
          <div>
            <Link
              href="/dashboard"
              className="self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-outline-variant text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-all shadow-sm group mb-4"
            >
              <span className="material-symbols-outlined text-[16px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
              Back to Dashboard
            </Link>
            <p className="font-mono text-xs text-secondary uppercase tracking-widest mb-2 flex items-center gap-2 font-bold">
              <span className="material-symbols-outlined text-sm animate-pulse">smart_toy</span>
              Quartermaster AI
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-primary-container tracking-tight">Receipt Scanner</h2>
            <p className="font-body-md text-on-surface-variant mt-2 max-w-xl">
              Feed your crumpled tavern receipts to our Quartermaster AI. It will automatically decipher the squiggles and calculate the plunder.
            </p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-4 py-2 bg-surface-container border border-outline-variant rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant font-bold text-sm"
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
            AI Settings
          </button>
        </div>

        {showSettings && (
          <div className="mb-8 p-6 bg-secondary-container/20 border border-secondary/30 rounded-xl">
            <h3 className="font-display text-xl font-bold text-primary-container mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">key</span>
              Bring Your Own API Key
            </h3>
            <p className="text-sm text-on-surface-variant mb-4 max-w-2xl">
              To use the AI Scanner, provide your own personal Gemini API Key. You can generate one for free using your Google/Gmail account at <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-secondary underline underline-offset-2">Google AI Studio</a>.
            </p>
            <input
              type="password"
              value={userApiKey}
              onChange={(e) => saveApiKey(e.target.value)}
              placeholder="Paste your AI Studio API Key here..."
              className="w-full max-w-md bg-surface border border-outline-variant rounded-lg px-4 py-3 text-on-surface font-mono text-sm focus:border-secondary focus:ring-1 focus:ring-secondary"
            />
            <p className="text-xs text-on-surface-variant mt-2">
              Your key is securely saved locally in your browser.
            </p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Upload Column */}
          <div className="bg-surface-container-low rounded-xl border border-outline-variant/30 p-6 shadow-sm h-fit">
            <h3 className="font-display text-2xl font-bold text-primary mb-4">1. Provide Receipt</h3>

            <label className="block w-full cursor-pointer">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageChange}
                className="hidden"
              />
              <div className={`w-full aspect-[3/4] rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-4 transition-all ${imagePreview ? 'border-primary/50 bg-primary/5' : 'border-outline-variant hover:border-secondary hover:bg-surface-container-high'
                }`}>
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt="Receipt preview" className="w-full h-full object-contain rounded-md shadow-sm" />
                ) : (
                  <div className="text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-5xl mb-2 text-secondary">add_a_photo</span>
                    <p className="font-bold">Snap a Photo or Upload</p>
                    <p className="text-xs mt-1">JPEG, PNG, WebP supported</p>
                  </div>
                )}
              </div>
            </label>

            {image && (
              <button
                onClick={handleScan}
                disabled={loading || !userApiKey}
                title={!userApiKey ? "Please enter your API Key in settings first" : ""}
                className="mt-6 w-full bg-secondary text-white font-bold uppercase tracking-wider py-4 rounded-xl shadow-md hover:bg-primary-container hover:-translate-y-1 transition-all disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin">sync</span>
                    Deciphering Ink...
                  </>
                ) : !userApiKey ? (
                  <>
                    <span className="material-symbols-outlined">key_off</span>
                    Missing API Key
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined group-hover:scale-110 transition-transform">document_scanner</span>
                    Scan with Quartermaster AI
                  </>
                )}
              </button>
            )}

            {errorMsg && (
              <div className="mt-4 p-4 bg-error-container text-on-error-container rounded-lg font-bold flex items-center gap-2 text-sm border border-error/20">
                <span className="material-symbols-outlined">warning</span>
                {errorMsg}
              </div>
            )}
          </div>

          {/* Results Column */}
          <div className={`bg-surface-container-low rounded-xl border border-outline-variant/30 p-6 shadow-sm transition-opacity duration-500 ${amount || description ? 'opacity-100' : 'opacity-30 pointer-events-none'
            }`}>
            <h3 className="font-display text-2xl font-bold text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">verified</span>
              2. Verify & Save
            </h3>

            <form onSubmit={handleSave} className="flex flex-col gap-5">
              <div>
                <label className="block font-bold text-on-surface mb-2 font-body flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-sm">edit_note</span>
                  What was purchased?
                </label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-3 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="e.g., Tavern Supplies"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-on-surface mb-2 font-body flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-sm">payments</span>
                    Total Amount
                  </label>
                  <div className="flex bg-surface border border-outline-variant rounded-lg overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="bg-surface-container-high border-r border-outline-variant px-3 py-3 text-on-surface font-bold outline-none"
                    >
                      <option value="INR">₹ INR</option>
                      <option value="USD">$ USD</option>
                      <option value="EUR">€ EUR</option>
                      <option value="GBP">£ GBP</option>
                      <option value="AUD">A$ AUD</option>
                      <option value="JPY">¥ JPY</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="flex-1 px-4 py-3 bg-transparent text-on-surface font-mono font-bold outline-none"
                      placeholder="0.00"
                    />
                  </div>
                  {currency !== 'INR' && amount && (
                    <p className="text-[10px] text-secondary mt-1 font-mono tracking-wider animate-pulse">
                      *Will be converted to INR at current market rate
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-on-surface mb-2 font-body flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-sm">category</span>
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-3 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    <option value="food">Food</option>
                    <option value="drinks">Drinks</option>
                    <option value="activities">Activities</option>
                    <option value="shopping">Shopping</option>
                    <option value="transport">Transport</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-outline-variant/30">
                <label className="block font-bold text-on-surface mb-2 font-body flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-sm">sailing</span>
                  Log to which Ledger?
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-3 text-on-surface font-bold focus:border-primary focus:ring-1 focus:ring-primary mb-6"
                >
                  <option value="">👤 Personal Expense (Just Me)</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>⚓ Voyage: {g.group_name}</option>
                  ))}
                </select>

                <button
                  type="submit"
                  disabled={isSubmitting || isConverting}
                  className="w-full bg-primary-container text-on-primary-container font-bold uppercase tracking-wider py-4 rounded-xl shadow-sm hover:bg-primary hover:text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isConverting ? 'Converting...' : isSubmitting ? 'Saving...' : 'Save to Ledger'}
                  <span className="material-symbols-outlined">save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
