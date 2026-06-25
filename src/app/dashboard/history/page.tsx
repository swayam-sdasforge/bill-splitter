'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

type Expense = {
  id: string;
  description: string;
  amount: number;
  created_at: string;
  type: 'personal' | 'voyage';
  voyageName?: string;
  voyageId?: string;
};

type Group = {
  id: string;
  group_name: string;
};

export default function HistoryPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [voyageFilter, setVoyageFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    const fetchHistory = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;

      // Fetch personal expenses
      const { data: personalData } = await supabase
        .from('personal_expenses')
        .select('id, description, amount, created_at')
        .eq('user_id', uid);

      // Fetch ALL group expenses for groups the user is a part of
      const { data: groupExpData } = await supabase
        .from('group_expenses')
        .select('id, description, amount, created_at, group_id');

      // Fetch user's groups
      const { data: groupData } = await supabase
        .from('shared_groups')
        .select('id, group_name');

      if (groupData) {
        setGroups(groupData);
      }

      const combined: Expense[] = [];

      if (personalData) {
        personalData.forEach((e: { id: string; description: string; amount: number; created_at: string }) => combined.push({ ...e, type: 'personal' }));
      }

      if (groupExpData && groupExpData.length > 0 && groupData) {
        const nameMap: Record<string, string> = {};
        groupData.forEach((g: { id: string; group_name: string }) => { nameMap[g.id] = g.group_name; });

        groupExpData.forEach((e: { id: string; description: string; amount: number; created_at: string; group_id: string }) => combined.push({
          ...e,
          type: 'voyage',
          voyageName: nameMap[e.group_id] || 'Unknown Voyage',
          voyageId: e.group_id
        }));
      }

      // Sort by date descending
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setExpenses(combined);
      setLoading(false);
    };

    fetchHistory();
  }, []);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      // Voyage Filter
      if (voyageFilter === 'personal' && exp.type !== 'personal') return false;
      if (voyageFilter !== 'all' && voyageFilter !== 'personal' && exp.voyageId !== voyageFilter) return false;

      // Date Range Filter
      const expDate = new Date(exp.created_at).getTime();
      if (startDate) {
        const start = new Date(startDate).getTime();
        if (expDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Include the whole end day
        if (expDate > end.getTime()) return false;
      }

      return true;
    });
  }, [expenses, voyageFilter, startDate, endDate]);

  const totalFiltered = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex selection:bg-secondary-container selection:text-on-secondary-container">
      {/* SideNavBar (Desktop Only) */}
      <nav 
        className="hidden md:flex flex-col h-screen fixed left-0 top-0 z-40 w-72 border-r-2 border-double border-outline-variant bg-surface-container bg-cover bg-center shadow-[4px_0_15px_-3px_rgba(88,28,135,0.08)]"
        style={{ backgroundImage: "linear-gradient(rgba(26, 24, 32, 0.85), rgba(26, 24, 32, 0.85)), url('/retro_castle_bg.png')" }}
      >
        <div className="p-container-margin border-b border-outline-variant border-dashed">
          <h1 className="font-headline-lg text-headline-lg font-bold text-primary">Welcome Aboard,</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1 truncate">
            Stateroom 402B
          </p>
        </div>
        <div className="flex-1 overflow-y-auto py-unit-8 flex flex-col gap-2 px-unit">
          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-secondary-container font-bold border-l-4 border-secondary bg-secondary-container/20 transform scale-[0.99] transition-all">
            <span className="material-symbols-outlined" data-icon="anchor">anchor</span>
            <span className="font-label-sm text-label-sm">Home</span>
          </Link>
          <Link href="/dashboard/expenses" className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:text-primary hover:bg-secondary-container/50 transition-colors duration-300">
            <span className="material-symbols-outlined" data-icon="receipt_long">receipt_long</span>
            <span className="font-label-sm text-label-sm">Expenses</span>
          </Link>
          <Link href="/dashboard/groups" className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:text-primary hover:bg-secondary-container/50 transition-colors duration-300">
            <span className="material-symbols-outlined" data-icon="group">group</span>
            <span className="font-label-sm text-label-sm">Groups</span>
          </Link>
          <Link href="/dashboard/chat" className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:text-primary hover:bg-secondary-container/50 transition-colors duration-300">
            <span className="material-symbols-outlined text-green-500 animate-pulse" data-icon="chat">chat</span>
            <span className="font-label-sm text-label-sm font-bold text-green-500">Global Chat</span>
          </Link>
          <Link href="/dashboard/destinations" className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:text-primary hover:bg-secondary-container/50 transition-colors duration-300">
            <span className="material-symbols-outlined" data-icon="explore">explore</span>
            <span className="font-label-sm text-label-sm">World Map</span>
          </Link>
          <Link href="/dashboard/scanner" className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:text-primary hover:bg-secondary-container/50 transition-colors duration-300">
            <span className="material-symbols-outlined" data-icon="document_scanner">document_scanner</span>
            <span className="font-label-sm text-label-sm">AI Scanner</span>
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 md:ml-72 flex flex-col min-h-screen relative bg-surface-dim overflow-hidden">
        {/* Retro Castle & Currency Background */}
        <div
          className="absolute inset-0 z-0 opacity-40 pointer-events-none"
          style={{ backgroundImage: "url('/castle_currency_bg.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
        ></div>
        <div className="absolute inset-0 z-0 bg-surface/60 pointer-events-none"></div>

        <div className="flex-1 p-gutter md:p-container-margin pb-section-gap relative z-10 max-w-5xl mx-auto w-full">
          <header className="mb-section-gap flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mt-8 md:mt-0">
            <div>
              <Link href="/dashboard" className="inline-flex items-center gap-2 mb-4 text-sm font-label-sm text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                Back to Dashboard
              </Link>
              <h2 className="font-display-lg text-display-lg text-primary mb-2 flex items-center gap-3">
                <span className="material-symbols-outlined text-4xl text-secondary">history</span>
                Ledger History
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
                Review all your past expenditures across personal journeys and group voyages.
              </p>
            </div>
            
            <div className="bg-surface-container-high border-2 border-dashed border-outline-variant rounded p-4 shadow-sm min-w-[200px] text-right">
              <span className="font-mono text-xs uppercase text-on-surface-variant font-bold block mb-1">Filtered Total</span>
              <span className="font-headline-lg text-headline-lg text-primary-container font-bold">
                ₹{totalFiltered.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </header>

          {/* Filters */}
          <section className="bg-surface-container-low border border-outline-variant p-5 rounded-lg shadow-sm mb-6 flex flex-col lg:flex-row gap-5 items-end">
            <div className="flex-1 w-full">
              <label className="block font-mono text-xs uppercase text-on-surface-variant font-bold mb-2">
                Filter by Category
              </label>
              <select
                className="w-full bg-background border border-outline-variant rounded p-2.5 text-on-surface focus:outline-none focus:border-secondary transition-colors"
                value={voyageFilter}
                onChange={(e) => setVoyageFilter(e.target.value)}
              >
                <option value="all">🌐 All Expenses (Personal + Voyages)</option>
                <option value="personal">🏠 Personal Only</option>
                <optgroup label="Your Voyages">
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>⚓ {g.group_name}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="flex-1 w-full flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block font-mono text-xs uppercase text-on-surface-variant font-bold mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  className="w-full bg-background border border-outline-variant rounded p-2.5 text-on-surface focus:outline-none focus:border-secondary transition-colors"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="block font-mono text-xs uppercase text-on-surface-variant font-bold mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  className="w-full bg-background border border-outline-variant rounded p-2.5 text-on-surface focus:outline-none focus:border-secondary transition-colors"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex-shrink-0 w-full lg:w-auto">
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); setVoyageFilter('all'); }}
                className="w-full lg:w-auto px-4 py-2.5 border border-outline-variant rounded bg-surface hover:bg-surface-container text-on-surface-variant transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">clear_all</span>
                Reset
              </button>
            </div>
          </section>

          {/* Table */}
          <section className="bg-surface-container border-2 border-double border-outline-variant p-1 shadow-sm relative overflow-hidden">
            <div className="bg-background border border-outline-variant overflow-x-auto min-h-[400px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-outline-variant bg-surface-container-highest font-mono text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    <th className="p-4">Date</th>
                    <th className="p-4">Description</th>
                    <th className="p-4">Voyage / Type</th>
                    <th className="p-4 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="font-body-md text-body-md relative">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-4xl animate-spin text-secondary mb-3">refresh</span>
                        <p>Accessing the ship&apos;s archives...</p>
                      </td>
                    </tr>
                  ) : filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-on-surface-variant bg-surface-container-low">
                        <span className="material-symbols-outlined text-5xl opacity-40 mb-3">receipt_long</span>
                        <p className="font-bold">No entries found</p>
                        <p className="text-sm">Try adjusting your date range or filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="border-b border-outline-variant border-dashed hover:bg-surface-container-low transition-colors group">
                        <td className="p-4 text-on-surface-variant text-sm whitespace-nowrap">
                          {new Date(exp.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="p-4 text-primary font-bold group-hover:text-secondary transition-colors">
                          {exp.description}
                        </td>
                        <td className="p-4">
                          {exp.type === 'voyage' ? (
                            <Link href={`/dashboard/groups/${exp.voyageId}`} className="inline-flex items-center gap-1.5 bg-secondary-container/30 px-2.5 py-1 rounded text-sm border border-secondary/20 hover:border-secondary/60 transition-colors">
                              <span className="material-symbols-outlined text-[14px] text-secondary">sailing</span>
                              {exp.voyageName}
                            </Link>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 bg-primary-fixed/50 px-2.5 py-1 rounded text-sm border border-primary/10">
                              <span className="material-symbols-outlined text-[14px]">person</span> Personal
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right font-display text-lg font-bold text-primary-container whitespace-nowrap">
                          ₹{Number(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Decorative Wave Divider */}
        <div className="relative h-12 w-full mt-10">
          <div className="wave-divider h-12 w-full transform rotate-180"></div>
        </div>
      </main>
    </div>
  );
}
