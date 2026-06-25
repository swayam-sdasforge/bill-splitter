'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import BottomSheetTooltip from '@/components/ui/BottomSheetTooltip';

type Saving = {
  id: string;
  amount: number;
  user_id: string;
  users?: { name: string };
};

export default function SavingsVault({ groupId, userId, isCaptain, savingsGoal, onGoalUpdated }: { groupId: string, userId: string | null, isCaptain: boolean, savingsGoal: number, onGoalUpdated: (goal: number) => void }) {
  const [savings, setSavings] = useState<Saving[]>([]);
  const [totalSaved, setTotalSaved] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [isEditingGoal, setIsEditingGoal] = useState(false);

  useEffect(() => {
    const fetchSavings = async () => {
      const { data, error } = await supabase
        .from('voyage_savings')
        .select(`*, users(name)`)
        .eq('group_id', groupId);

      if (!error && data) {
        setSavings(data as any);
        setTotalSaved(data.reduce((sum, s) => sum + Number(s.amount), 0));
      }
      setLoading(false);
    };

    fetchSavings();
  }, [groupId]);

  const handleSetGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal) return;
    
    const parsedGoal = parseFloat(newGoal);
    const { error } = await supabase
      .from('shared_groups')
      .update({ savings_goal: parsedGoal })
      .eq('id', groupId);

    if (!error) {
      onGoalUpdated(parsedGoal);
      setIsEditingGoal(false);
      setNewGoal('');
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositAmount || !userId) return;

    const parsedAmount = parseFloat(depositAmount);
    const { data, error } = await supabase
      .from('voyage_savings')
      .insert([{ group_id: groupId, user_id: userId, amount: parsedAmount }])
      .select(`*, users(name)`)
      .single();

    if (!error && data) {
      setSavings(prev => [...prev, data as any]);
      setTotalSaved(prev => prev + parsedAmount);
      setShowDeposit(false);
      setDepositAmount('');
    }
  };

  if (loading) return null;

  const hasGoal = savingsGoal > 0;
  const progress = hasGoal ? Math.min((totalSaved / savingsGoal) * 100, 100) : 0;

  return (
    <div className="mb-8 bg-surface-container-highest border border-outline-variant/50 rounded-xl p-6 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <span className="material-symbols-outlined text-[100px]">diamond</span>
      </div>

      <div className="flex items-center justify-between mb-4 relative z-10">
        <h3 className="font-display text-2xl font-bold text-primary-container flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[28px]">lock</span>
          Buried Treasure (Savings Vault)
        </h3>
        
        {isCaptain && (!hasGoal || isEditingGoal) ? (
          <form onSubmit={handleSetGoal} className="flex items-center gap-2">
            <input 
              type="number" 
              value={newGoal} 
              onChange={e => setNewGoal(e.target.value)} 
              placeholder="Set Goal (₹)"
              className="bg-surface border border-outline-variant rounded px-3 py-1 text-sm font-mono focus:border-secondary focus:ring-1 focus:ring-secondary w-32"
            />
            <button type="submit" className="bg-secondary text-white px-3 py-1 rounded text-sm font-bold uppercase hover:bg-primary transition-colors">Save Goal</button>
            {hasGoal && <button type="button" onClick={() => setIsEditingGoal(false)} className="text-xs text-on-surface-variant hover:underline">Cancel</button>}
          </form>
        ) : isCaptain && hasGoal ? (
          <button onClick={() => setIsEditingGoal(true)} className="text-xs text-secondary font-mono tracking-widest uppercase hover:underline">
            Edit Goal
          </button>
        ) : null}
      </div>

      {!hasGoal && !isCaptain ? (
        <p className="text-sm text-on-surface-variant italic">The Captain has not set a savings goal for this voyage yet.</p>
      ) : hasGoal ? (
        <div className="relative z-10">
          <div className="flex justify-between items-end mb-2">
            <div className="flex flex-col">
              <span className="text-xs text-on-surface-variant font-mono uppercase tracking-widest">Total Saved</span>
              <span className="font-display text-3xl font-bold text-secondary">₹{totalSaved.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs text-on-surface-variant font-mono uppercase tracking-widest">Goal</span>
              <span className="font-display text-xl font-bold text-on-surface opacity-80">₹{savingsGoal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          
          <div className="w-full h-4 bg-surface rounded-full overflow-hidden border border-outline-variant/30 mb-6">
            <div 
              className="h-full bg-secondary transition-all duration-1000 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/20 w-full animate-pulse"></div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {savings.length === 0 ? (
                <span className="text-xs text-on-surface-variant">The chest is empty!</span>
              ) : (
                <div className="flex -space-x-2">
                  {savings.slice(0, 5).map((s, i) => (
                    <BottomSheetTooltip key={i} text={`${s.users?.name}: ₹${s.amount}`}>
                      <div className="w-8 h-8 rounded-full bg-primary-container border-2 border-surface flex items-center justify-center text-xs font-bold text-white shadow-sm">
                        {s.users?.name?.charAt(0).toUpperCase() || 'P'}
                      </div>
                    </BottomSheetTooltip>
                  ))}
                  {savings.length > 5 && (
                    <div className="w-8 h-8 rounded-full bg-surface-container-high border-2 border-surface flex items-center justify-center text-[10px] font-bold text-on-surface-variant shadow-sm">
                      +{savings.length - 5}
                    </div>
                  )}
                </div>
              )}
            </div>

            {showDeposit ? (
              <form onSubmit={handleDeposit} className="flex items-center gap-2 w-full sm:w-auto">
                <input 
                  type="number"
                  required
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  placeholder="Amount (₹)"
                  className="bg-surface border border-outline-variant rounded px-3 py-2 text-sm font-mono focus:border-secondary w-32"
                />
                <button type="submit" className="bg-secondary text-white px-4 py-2 rounded text-sm font-bold uppercase hover:bg-primary transition-colors flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">add</span> Bury
                </button>
                <button type="button" onClick={() => setShowDeposit(false)} className="text-on-surface-variant hover:text-error transition-colors p-1">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </form>
            ) : (
              <button 
                onClick={() => setShowDeposit(true)}
                className="bg-surface-container border border-outline-variant hover:bg-secondary/10 hover:text-secondary hover:border-secondary/30 text-on-surface font-bold text-sm px-4 py-2 rounded-lg transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                Bury Treasure
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
