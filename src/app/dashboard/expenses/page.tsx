'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import BottomSheetTooltip from '@/components/ui/BottomSheetTooltip';
import Link from 'next/link';

type Expense = {
  id: string;
  amount: number;
  description: string;
  category: string;
  created_at?: string;
  isPersonal?: boolean;
};

type Group = {
  id: string;
  group_name: string;
  status?: string;
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<{id: string, name: string, isGuest?: boolean, avatar?: string}[]>([]);
  const [paidByUserId, setPaidByUserId] = useState<string>('');
  const [attachLocation, setAttachLocation] = useState(false);
  
  // Recurring & Gallery State
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  // Currency State
  const [currency, setCurrency] = useState('INR');
  const [isConverting, setIsConverting] = useState(false);

  // Custom Splits State
  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'percentage' | 'shares' | 'itemized'>('equal');
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});

  // Itemized Split State
  type ItemSplit = { id: string; name: string; price: string; assignedTo: string[] };
  const [items, setItems] = useState<ItemSplit[]>([]);

  // Helper for consistent avatar
  const getPirateAvatar = (id: string) => {
    const avatars = ['🏴‍☠️', '🦜', '⚓', '🧜‍♀️', '🦑', '🦈', '🦀', '🪙'];
    const charCodeSum = id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return avatars[charCodeSum % avatars.length];
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);

      // Sync user profile
      await supabase.from('users').upsert({
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.user_metadata?.full_name || 'User'
      });

      // Fetch personal expenses
      const { data: personalData } = await supabase
        .from('personal_expenses')
        .select('*')
        .eq('user_id', session.user.id);
        
      // Fetch group expenses paid by user
      const { data: groupExpData } = await supabase
        .from('group_expenses')
        .select('id, amount, description, created_at')
        .eq('paid_by', session.user.id);

      const combined: Expense[] = [];
      if (personalData) combined.push(...personalData.map((e: { id: string; amount: number; description: string; category: string; created_at?: string }) => ({ ...e, isPersonal: true })));
      if (groupExpData) combined.push(...groupExpData.map((e: { id: string; amount: number; description: string; created_at?: string }) => ({ ...e, category: 'voyage', isPersonal: false })));
      
      combined.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setExpenses(combined);

      // Fetch user's voyages — RLS will ensure they only see voyages they created or joined
      const { data: groupData } = await supabase
        .from('shared_groups')
        .select('id, group_name, status')
        .order('created_at', { ascending: false });
      
      // Filter out finished groups since we can't add expenses to them
      if (groupData) setGroups(groupData.filter(g => g.status !== 'finished'));
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!selectedGroupId) {
        setGroupMembers([]);
        setPaidByUserId(userId || '');
        return;
      }
      
      const { data: membersData } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', selectedGroupId);

      const { data: guestsData } = await supabase
        .from('voyage_guests')
        .select('id, guest_name')
        .eq('group_id', selectedGroupId);
        
      if (membersData && membersData.length > 0) {
        const userIds = membersData.map(m => m.user_id);
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, email, active_avatar')
          .in('id', userIds);
          
        if (usersData) {
          const members = usersData.map(u => ({
            id: u.id,
            name: u.name || u.email || 'Unknown User',
            isGuest: false,
            avatar: u.active_avatar || '🏴‍☠️'
          }));

          if (guestsData) {
            guestsData.forEach(g => {
              members.push({ id: g.id, name: g.guest_name, isGuest: true, avatar: getPirateAvatar(g.id) });
            });
          }

          setGroupMembers(members);
          
          if (members.some(m => m.id === userId)) {
            setPaidByUserId(userId || '');
          } else if (members.length > 0) {
            setPaidByUserId(members[0].id);
          }
        }
      }
    };
    fetchMembers();
  }, [selectedGroupId, userId]);

  const getEmojiForCategory = (cat: string) => {
    switch (cat) {
      case 'food': return '🍹';
      case 'drinks': return '🍸';
      case 'activities': return '🌊';
      case 'shopping': return '🛍️';
      default: return '🏷️';
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !userId) return;
    setLoading(true);
    setIsConverting(true);

    try {
      let finalAmountInr = parseFloat(amount);
      let exchangeRate = 1.0;

      // Currency Conversion if not INR
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

      let photoUrl = null;
      if (photo) {
        const fileExt = photo.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('gallery').upload(filePath, photo);
        if (uploadError) {
          console.error("Upload error", uploadError);
        } else {
          const { data } = supabase.storage.from('gallery').getPublicUrl(filePath);
          photoUrl = data.publicUrl;
        }
      }

      if (selectedGroupId) {
        const selectedMember = groupMembers.find(m => m.id === paidByUserId);
        const isGuest = selectedMember?.isGuest;

        const insertData: any = {
          id: newId,
          group_id: selectedGroupId,
          description,
          amount: finalAmountInr,
          original_currency: currency,
          exchange_rate: exchangeRate,
          category,
          photo_url: photoUrl,
          split_type: splitType
        };

        if (isGuest) {
          insertData.paid_by_guest = paidByUserId;
        } else {
          insertData.paid_by = paidByUserId || userId;
        }

        // Fetch location if requested
        if (attachLocation && 'geolocation' in navigator) {
          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
            });
            insertData.lat = position.coords.latitude;
            insertData.lng = position.coords.longitude;
            insertData.location_name = "Port of Call"; 
          } catch (err) {
            console.warn("Could not fetch location:", err);
          }
        }

        const { error } = await supabase
          .from('group_expenses')
          .insert([insertData]);
        if (error) throw error;

        // Privateer Contracts (Unequal Splits) insertion
        if (splitType !== 'equal') {
          const splitsToInsert = [];
          if (splitType === 'exact') {
            for (const m of groupMembers) {
              const val = parseFloat(splitValues[m.id] || '0');
              if (val > 0) splitsToInsert.push({ expense_id: newId, user_id: m.isGuest ? null : m.id, guest_id: m.isGuest ? m.id : null, amount: val });
            }
          } else if (splitType === 'percentage') {
            for (const m of groupMembers) {
              const pct = parseFloat(splitValues[m.id] || '0');
              if (pct > 0) splitsToInsert.push({ expense_id: newId, user_id: m.isGuest ? null : m.id, guest_id: m.isGuest ? m.id : null, amount: (pct / 100) * finalAmountInr });
            }
          } else if (splitType === 'shares') {
            const totalShares = groupMembers.reduce((sum, m) => sum + parseFloat(splitValues[m.id] || '0'), 0);
            if (totalShares > 0) {
              for (const m of groupMembers) {
                const shares = parseFloat(splitValues[m.id] || '0');
                if (shares > 0) splitsToInsert.push({ expense_id: newId, user_id: m.isGuest ? null : m.id, guest_id: m.isGuest ? m.id : null, amount: (shares / totalShares) * finalAmountInr });
              }
            }
          } else if (splitType === 'itemized') {
             const subtotal = items.reduce((sum, item) => sum + parseFloat(item.price || '0'), 0);
             const remainder = finalAmountInr - subtotal;
             
             for (const m of groupMembers) {
               let memberSubtotal = 0;
               items.forEach(item => {
                 if (item.assignedTo.includes(m.id)) {
                   memberSubtotal += parseFloat(item.price || '0') / item.assignedTo.length;
                 }
               });
               
               if (memberSubtotal > 0 || subtotal === 0) {
                  const memberProportion = subtotal > 0 ? memberSubtotal / subtotal : (1 / groupMembers.length);
                  const memberTotal = memberSubtotal + (memberProportion * remainder);
                  
                  if (memberTotal > 0) {
                     splitsToInsert.push({
                        expense_id: newId, 
                        user_id: m.isGuest ? null : m.id, 
                        guest_id: m.isGuest ? m.id : null, 
                        amount: memberTotal 
                     });
                  }
               }
             }
          }
          if (splitsToInsert.length > 0) {
             const { error: splitError } = await supabase.from('expense_splits').insert(splitsToInsert);
             if (splitError) console.error("Split error:", splitError);
          }
        }

        if (!isGuest && (!paidByUserId || paidByUserId === userId)) {
          setExpenses(prev => [{
            id: newId,
            description,
            amount: finalAmountInr,
            category: 'voyage',
            created_at: new Date().toISOString(),
            isPersonal: false
          }, ...prev]);
        }
      } else {
        const { error } = await supabase
          .from('personal_expenses')
          .insert([{ id: newId, user_id: userId, description, amount: finalAmountInr, category, photo_url: photoUrl }]);
        if (error) throw error;
        setExpenses(prev => [{ id: newId, description, amount: finalAmountInr, category, created_at: new Date().toISOString(), isPersonal: true }, ...prev]);
      }

      if (isRecurring) {
        const nextDueDate = new Date();
        if (frequency === 'weekly') {
          nextDueDate.setDate(nextDueDate.getDate() + 7);
        } else {
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        }
        
        await supabase.from('recurring_expenses').insert([{
          group_id: selectedGroupId || null,
          paid_by: paidByUserId || userId,
          amount: finalAmountInr,
          description,
          category,
          frequency,
          next_due_date: nextDueDate.toISOString().split('T')[0]
        }]);
      }

      setDescription('');
      setAmount('');
      setCategory('');
      setSelectedGroupId('');
      setPhoto(null);
      setPhotoPreview(null);
      setIsRecurring(false);
      alert('✅ Expense added!');
    } catch (err: any) {
      alert('Failed to save expense: ' + err.message);
    } finally {
      setLoading(false);
      setIsConverting(false);
    }
  };

  const handleDelete = async (expense: Expense) => {
    if (!expense.isPersonal) {
      alert("Voyage expenses must be deleted from the specific Voyage Ledger page.");
      return;
    }
    const { error } = await supabase.from('personal_expenses').delete().eq('id', expense.id);
    if (!error) {
      setExpenses(expenses.filter(e => e.id !== expense.id));
    }
  };

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div 
        className="fixed inset-0 z-0 opacity-60 pointer-events-none scale-110" 
        style={{ backgroundImage: "url('/image_5.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
      ></div>
      <div className="max-w-5xl mx-auto w-full relative z-10 p-4 md:p-8">
      <div className="flex flex-col mb-10 gap-4">
        <Link href="/dashboard" className="self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-outline-variant text-sm font-label-sm text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-all shadow-sm group">
          <span className="material-symbols-outlined text-[16px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
          Back to Dashboard
        </Link>
        
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-xs text-secondary uppercase tracking-widest mb-2 flex items-center font-bold">
              <span className="material-symbols-outlined mr-2 text-[18px]">receipt_long</span>
            Passage Log
          </p>
          <h2 className="font-display text-5xl text-primary-container font-bold tracking-tight">My Expenses</h2>
        </div>
      </div>
    </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        <div className="lg:col-span-5 bg-surface-container-highest border-2 border-double border-outline-variant p-8 shadow-sm relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-multiply" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=\\'100\\' height=\\'100\\' viewBox=\\'0 0 100 100\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cfilter id=\\'noise\\'%3E%3CfeTurbulence type=\\'fractalNoise\\' baseFrequency=\\'0.8\\' numOctaves=\\'4\\' stitchTiles=\\'stitch\\'/%3E%3C/filter%3E%3Crect width=\\'100\\' height=\\'100\\' filter=\\'url(%23noise)\\'/%3E%3C/svg%3E')" }}></div>
          
          <h3 className="font-display text-2xl font-bold text-primary mb-6 flex items-center border-b border-outline-variant pb-4 relative z-10">
            <span className="material-symbols-outlined mr-2">edit_document</span>
            Record New Entry
          </h3>
          
          <form onSubmit={handleAddExpense} className="space-y-6 relative z-10">
            <div>
              <label className="block font-mono text-xs text-on-surface-variant uppercase mb-1 font-bold">Description</label>
              <input 
                className="w-full ledger-input font-body text-lg text-on-surface focus:outline-none" 
                placeholder="e.g., Sunset Cocktail Hour" 
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
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
                <label className="block font-mono text-xs text-on-surface-variant uppercase mb-1 font-bold">Category</label>
                <select 
                  className="w-full ledger-input font-body text-base text-on-surface py-1 focus:outline-none"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                >
                  <option disabled value="">Select...</option>
                  <option value="food">🍹 Food</option>
                  <option value="drinks">🍸 Drinks</option>
                  <option value="activities">🌊 Activities</option>
                  <option value="shopping">🛍️ Shopping</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-mono text-xs text-on-surface-variant uppercase mb-2 font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">sailing</span>
                Assign to Voyage
                <span className="text-outline-variant font-normal normal-case tracking-normal ml-1">(optional)</span>
              </label>
              <select
                className="w-full ledger-input font-body text-base text-on-surface py-1 focus:outline-none"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
              >
                <option value="">🏠 Personal (no voyage)</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>⚓ {g.group_name}</option>
                ))}
              </select>
            </div>

            {selectedGroupId && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block font-mono text-xs text-on-surface-variant uppercase mb-2 font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">person</span>
                    Paid By
                  </label>
                  <select
                    className="w-full ledger-input font-body text-base text-on-surface py-1 focus:outline-none"
                    value={paidByUserId}
                    onChange={(e) => setPaidByUserId(e.target.value)}
                    required
                  >
                    <option disabled value="">Select who paid...</option>
                    {groupMembers.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.id === userId ? '(You)' : m.isGuest ? '(Guest)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-surface border border-outline-variant/40 rounded-lg p-4">
                  <label className="block font-mono text-xs text-on-surface-variant uppercase mb-2 font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">balance</span>
                    Privateer Contracts (Split Type)
                  </label>
                  <div className="flex bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
                    <button type="button" onClick={() => setSplitType('equal')} className={`flex-1 py-2 text-xs font-bold font-mono uppercase tracking-widest ${splitType === 'equal' ? 'bg-secondary text-white' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>Equal</button>
                    <button type="button" onClick={() => setSplitType('exact')} className={`flex-1 py-2 text-xs font-bold font-mono uppercase tracking-widest ${splitType === 'exact' ? 'bg-secondary text-white' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>Exact</button>
                    <button type="button" onClick={() => setSplitType('percentage')} className={`flex-1 py-2 text-xs font-bold font-mono uppercase tracking-widest ${splitType === 'percentage' ? 'bg-secondary text-white' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>%</button>
                    <button type="button" onClick={() => setSplitType('shares')} className={`flex-1 py-2 text-xs font-bold font-mono uppercase tracking-widest ${splitType === 'shares' ? 'bg-secondary text-white' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>Shares</button>
                    <button type="button" onClick={() => setSplitType('itemized')} className={`flex-1 py-2 text-xs font-bold font-mono uppercase tracking-widest ${splitType === 'itemized' ? 'bg-secondary text-white' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>Items</button>
                  </div>
                  {splitType !== 'equal' && splitType !== 'itemized' && (
                    <div className="mt-4 space-y-2">
                      {groupMembers.map(m => (
                        <div key={m.id} className="flex items-center justify-between gap-4">
                          <span className="text-sm font-bold text-on-surface truncate">{m.name}</span>
                          <div className="flex items-center gap-2 w-1/3">
                            <input type="number" step="0.01" min="0" placeholder="0" className="w-full bg-surface border border-outline-variant rounded-md px-2 py-1 text-sm focus:outline-none focus:border-secondary" value={splitValues[m.id] || ''} onChange={(e) => setSplitValues({...splitValues, [m.id]: e.target.value})} />
                            <span className="text-xs font-mono text-on-surface-variant">{splitType === 'percentage' ? '%' : splitType === 'shares' ? 'sh' : '₹'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {splitType === 'itemized' && (
                    <div className="mt-4 space-y-4">
                      {items.map((item, index) => (
                        <div key={item.id} className="bg-background rounded-lg border border-outline-variant p-3 flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <input type="text" placeholder="Item Name (e.g. Rum)" className="flex-1 bg-surface border border-outline-variant rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-secondary" value={item.name} onChange={(e) => { const newItems = [...items]; newItems[index].name = e.target.value; setItems(newItems); }} />
                            <input type="number" step="0.01" min="0" placeholder="₹ Price" className="w-24 bg-surface border border-outline-variant rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-secondary" value={item.price} onChange={(e) => { const newItems = [...items]; newItems[index].price = e.target.value; setItems(newItems); }} />
                            <button type="button" onClick={() => setItems(items.filter(i => i.id !== item.id))} className="text-on-surface-variant hover:text-error transition-colors">
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {groupMembers.map(m => {
                              const isSelected = item.assignedTo.includes(m.id);
                              return (
                                <button 
                                  key={m.id} 
                                  type="button" 
                                  onClick={() => {
                                    const newItems = [...items];
                                    if (isSelected) {
                                      newItems[index].assignedTo = item.assignedTo.filter(id => id !== m.id);
                                    } else {
                                      newItems[index].assignedTo.push(m.id);
                                    }
                                    setItems(newItems);
                                  }}
                                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-bold transition-all ${isSelected ? 'bg-primary-container text-on-primary-container border-primary-container scale-105' : 'bg-surface border-outline-variant text-on-surface-variant opacity-70 hover:opacity-100'}`}
                                >
                                  <span className="text-[14px]">{m.avatar || getPirateAvatar(m.id)}</span>
                                  {m.name.split(' ')[0]}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={() => setItems([...items, { id: crypto.randomUUID(), name: '', price: '', assignedTo: [] }])} className="w-full py-2 border-2 border-dashed border-outline-variant rounded-lg text-secondary font-bold text-xs uppercase tracking-widest hover:border-secondary hover:bg-secondary/5 transition-all flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">add_circle</span> Add Item
                      </button>
                      {items.length > 0 && amount && (
                        <div className="bg-surface-container-high p-3 rounded-lg flex justify-between items-center text-xs font-mono font-bold">
                           <span className="uppercase text-on-surface-variant">Tax/Tip (Auto-Split):</span>
                           <span className="text-secondary">₹{Math.max(0, parseFloat(amount) - items.reduce((s, i) => s + parseFloat(i.price || '0'), 0)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="pt-6">
              {selectedGroupId && (
                <div className="flex flex-col gap-3 bg-surface border border-outline-variant/40 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="attachLocation"
                      checked={attachLocation}
                      onChange={(e) => setAttachLocation(e.target.checked)}
                      className="w-5 h-5 accent-secondary"
                    />
                    <label htmlFor="attachLocation" className="text-on-surface font-body font-bold flex items-center gap-2 cursor-pointer">
                      <span className="material-symbols-outlined text-secondary">location_on</span>
                      Drop an Anchor (Save GPS Location)
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="isRecurring"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="w-5 h-5 accent-secondary"
                    />
                    <label htmlFor="isRecurring" className="text-on-surface font-body font-bold flex items-center gap-2 cursor-pointer">
                      <span className="material-symbols-outlined text-secondary">update</span>
                      Make this a Recurring Toll?
                    </label>
                  </div>
                  {isRecurring && (
                    <div className="ml-8 mt-2">
                      <label className="block font-mono text-xs text-on-surface-variant uppercase mb-1 font-bold">Frequency</label>
                      <select
                        className="w-full max-w-xs ledger-input font-body text-sm text-on-surface py-1 focus:outline-none bg-background"
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="mb-6">
                <label className="block font-mono text-xs text-on-surface-variant uppercase mb-2 font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                  Attach Memory (Plunder Gallery)
                  <span className="text-outline-variant font-normal normal-case tracking-normal ml-1">(optional)</span>
                </label>
                <div className="flex items-center gap-4">
                  <label className="cursor-pointer bg-surface-container-high hover:bg-surface-container-highest transition-colors text-on-surface px-4 py-2 rounded-lg border border-outline-variant/50 font-bold text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">upload_file</span>
                    {photoPreview ? 'Change Photo' : 'Upload Photo'}
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                  </label>
                  {photoPreview && (
                    <div className="relative">
                      <img src={photoPreview} alt="Preview" className="w-12 h-12 object-cover rounded shadow-sm border border-outline-variant" />
                      <button type="button" onClick={() => { setPhoto(null); setPhotoPreview(null); }} className="absolute -top-2 -right-2 bg-error text-white rounded-full w-5 h-5 flex items-center justify-center shadow-md hover:bg-error/80">
                        <span className="material-symbols-outlined text-[12px]">close</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading || isConverting}
                className="ticket-btn w-full bg-primary-container text-white py-4 px-6 flex items-center justify-between shadow-sm hover:bg-primary transition-colors cursor-pointer group disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <div className="flex flex-col text-left">
                  <span className="font-mono text-[10px] text-secondary-container uppercase tracking-widest opacity-80 mb-1 font-bold">Action</span>
                  <span className="font-mono text-xs uppercase tracking-wider group-hover:tracking-widest transition-all font-bold">
                    {isConverting ? 'Converting...' : loading ? 'Issuing...' : 'Issue Ticket'}
                  </span>
                </div>
                <div className="absolute right-[4.5rem] top-2 bottom-2 w-px border-r-2 border-dashed border-white/30"></div>
                <div className="w-12 h-12 rounded-full border border-dashed border-secondary-container/50 flex items-center justify-center bg-primary transform group-hover:rotate-12 transition-transform">
                  <span className="material-symbols-outlined text-secondary-container">sailing</span>
                </div>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Expense List */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between border-b border-outline-variant pb-2">
            <h3 className="font-display text-2xl font-bold text-primary">Captain&apos;s Ledger</h3>
            <span className="font-mono text-xs font-bold text-on-surface-variant bg-surface-container px-3 py-1 border border-outline-variant rounded-full">
              Total: ₹{total.toFixed(2)}
            </span>
          </div>
          
          <div className="space-y-4">
            {expenses.length === 0 ? (
              <div className="text-center py-10 text-on-surface-variant font-body">
                No expenses recorded yet. Your ledger is clean!
              </div>
            ) : (
              expenses.map((expense) => (
                <div key={expense.id} className="bg-surface border border-outline-variant p-4 flex items-center justify-between hover:bg-surface-container-low transition-colors group shadow-sm relative overflow-hidden">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-surface-container-high rounded-full border border-outline-variant flex items-center justify-center text-xl mr-4 shadow-inner">
                      {getEmojiForCategory(expense.category)}
                    </div>
                    <div>
                      <h4 className="font-display text-lg font-bold text-on-surface">{expense.description}</h4>
                      <p className="font-mono text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mt-1">
                        {new Date(expense.created_at || '').toLocaleDateString()} • {expense.category}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div>
                      <span className="font-display text-2xl font-bold text-primary-container block group-hover:text-secondary transition-colors">
                        ₹{Number(expense.amount).toFixed(2)}
                      </span>
                      <span className="inline-block mt-1 font-mono text-[10px] font-bold uppercase bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded border border-secondary border-dashed">
                        Recorded
                      </span>
                    </div>
                    <BottomSheetTooltip text={expense.isPersonal ? "Delete expense" : "Voyage expenses cannot be deleted here"}>
                      <button 
                        onClick={() => handleDelete(expense)}
                        className={`transition-opacity p-2 rounded-full ${expense.isPersonal ? 'text-error opacity-0 group-hover:opacity-100 hover:bg-error/10' : 'text-on-surface-variant/30 cursor-not-allowed opacity-50'}`}
                        disabled={!expense.isPersonal}
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </BottomSheetTooltip>
                  </div>
                </div>
              ))
            )}
            
            {expenses.length > 0 && (
              <button className="w-full py-3 mt-2 border border-dashed border-outline-variant text-on-surface-variant font-mono text-xs uppercase tracking-widest hover:bg-surface-container-high transition-colors font-bold">
                Review Archive
              </button>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
