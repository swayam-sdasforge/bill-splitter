'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

type Transfer = {
  from: string;
  to: string;
  amount: number;
};

type SettlementData = {
  youOwe: { id: string; name: string; amount: number; isGuest?: boolean }[];
  owedToYou: { id: string; name: string; amount: number; isGuest?: boolean }[];
};

export default function SettleDebtsPage() {
  const [loading, setLoading] = useState(true);
  const [settlement, setSettlement] = useState<SettlementData>({ youOwe: [], owedToYou: [] });
  const [userId, setUserId] = useState<string | null>(null);
  const [fGroups, setFGroups] = useState<{id: string}[]>([]);

  useEffect(() => {
    const fetchDebts = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;

      // 1. Fetch finished groups where user is a member
      const { data: finishedGroups } = await supabase
        .from('shared_groups')
        .select('id, group_name')
        .eq('status', 'finished');

      if (!finishedGroups || finishedGroups.length === 0) {
        setLoading(false);
        return;
      }

      setFGroups(finishedGroups);
      setUserId(uid);

      const fGroupIds = finishedGroups.map(g => g.id);

      // 2. Fetch all members and guests for these groups
      const { data: fMembers } = await supabase.from('group_members').select('group_id, user_id').in('group_id', fGroupIds);
      const { data: fGuests } = await supabase.from('voyage_guests').select('id, group_id, guest_name').in('group_id', fGroupIds);
      
      // 3. Fetch all expenses for these groups (excluding mutiny disputes)
      const { data: fExpenses } = await supabase.from('group_expenses').select('amount, group_id, paid_by, paid_by_guest').in('group_id', fGroupIds).eq('is_disputed', false);

      // 3.5 Fetch Ship's Vault Transfers
      const { data: transfers } = await supabase.from('settlement_transfers').select('group_id, from_user, to_user, amount').in('group_id', fGroupIds);

      // Get names mapping
      const allUserIds = Array.from(new Set([
        ...(fMembers?.map(m => m.user_id) || []),
        ...(fExpenses?.map(e => e.paid_by).filter(Boolean) || [])
      ]));
      
      const { data: usersData } = await supabase.from('users').select('id, name').in('id', allUserIds);
      const nameMap: Record<string, string> = {};
      usersData?.forEach(u => { nameMap[u.id] = u.name || 'User'; });
      
      const guestNameMap: Record<string, string> = {};
      fGuests?.forEach(g => { guestNameMap[g.id] = g.guest_name; });

      // Calculate global net balances per person
      // Positive = Creditor (owed money), Negative = Debtor (owes money)
      const globalBalances: Record<string, number> = {};

      for (const group of finishedGroups) {
        const gId = group.id;
        const groupExps = fExpenses?.filter(e => e.group_id === gId) || [];
        const totalExp = groupExps.reduce((s, e) => s + Number(e.amount), 0);
        
        const members = fMembers?.filter(m => m.group_id === gId).map(m => m.user_id) || [];
        const guests = fGuests?.filter(g => g.group_id === gId).map(g => g.id) || [];
        const allParticipants = [...members, ...guests];
        const memberCount = allParticipants.length;

        if (memberCount > 0) {
          const perPersonShare = totalExp / memberCount;
          
          // Calculate net balance for this specific group
          const groupBalances: Record<string, number> = {};
          
          // Everyone starts by owing their share
          allParticipants.forEach(p => { groupBalances[p] = -perPersonShare; });
          
          // Add what each person paid
          groupExps.forEach(exp => {
            if (exp.paid_by) {
              if (groupBalances[exp.paid_by] === undefined) groupBalances[exp.paid_by] = 0;
              groupBalances[exp.paid_by] += Number(exp.amount);
            } else if (exp.paid_by_guest) {
              if (groupBalances[exp.paid_by_guest] === undefined) groupBalances[exp.paid_by_guest] = 0;
              groupBalances[exp.paid_by_guest] += Number(exp.amount);
            }
          });

          // Apply manual vault transfers (from_user paid to_user, so from_user balance increases, to_user balance decreases)
          const groupTransfers = transfers?.filter(t => t.group_id === gId) || [];
          groupTransfers.forEach(t => {
            if (groupBalances[t.from_user] !== undefined) groupBalances[t.from_user] += Number(t.amount);
            if (groupBalances[t.to_user] !== undefined) groupBalances[t.to_user] -= Number(t.amount);
          });

          // Add group balances to global balances
          Object.keys(groupBalances).forEach(pId => {
            if (!globalBalances[pId]) globalBalances[pId] = 0;
            globalBalances[pId] += groupBalances[pId];
          });
        }
      }

      // Now we have global balances. Let's run a greedy algorithm to settle debts.
      const debtors: { id: string; balance: number }[] = [];
      const creditors: { id: string; balance: number }[] = [];

      Object.keys(globalBalances).forEach(pId => {
        const bal = globalBalances[pId];
        if (bal < -0.01) debtors.push({ id: pId, balance: Math.abs(bal) });
        else if (bal > 0.01) creditors.push({ id: pId, balance: bal });
      });

      // Sort descending by amount to minimize transactions
      debtors.sort((a, b) => b.balance - a.balance);
      creditors.sort((a, b) => b.balance - a.balance);

      const calculatedTransfers: Transfer[] = [];
      let d = 0;
      let c = 0;

      while (d < debtors.length && c < creditors.length) {
        const debtor = debtors[d];
        const creditor = creditors[c];
        
        const amount = Math.min(debtor.balance, creditor.balance);
        
        calculatedTransfers.push({
          from: debtor.id,
          to: creditor.id,
          amount: amount
        });

        debtor.balance -= amount;
        creditor.balance -= amount;

        if (debtor.balance < 0.01) d++;
        if (creditor.balance < 0.01) c++;
      }

      // Filter transfers relevant to the current user
      const youOweList: SettlementData['youOwe'] = [];
      const owedToYouList: SettlementData['owedToYou'] = [];

      calculatedTransfers.forEach(t => {
        if (t.from === uid) {
          youOweList.push({
            id: t.to,
            name: nameMap[t.to] || guestNameMap[t.to] || 'Unknown',
            amount: t.amount,
            isGuest: !!guestNameMap[t.to]
          });
        } else if (t.to === uid) {
          owedToYouList.push({
            id: t.from,
            name: nameMap[t.from] || guestNameMap[t.from] || 'Unknown',
            amount: t.amount,
            isGuest: !!guestNameMap[t.from]
          });
        }
      });

      setSettlement({ youOwe: youOweList, owedToYou: owedToYouList });
      setLoading(false);
    };

    fetchDebts();
  }, []);

  const handleLogPayment = async (toUser: string, maxAmount: number) => {
    if (!userId) return;
    const amountStr = window.prompt(`Enter partial payment amount to log in the Ship's Vault (max ₹${maxAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}):`);
    if (!amountStr) return;
    const amount = Number(amountStr);
    if (isNaN(amount) || amount <= 0 || amount > maxAmount) {
      alert("Invalid amount.");
      return;
    }
    
    // Find a shared group
    const { data: mData } = await supabase.from('group_members').select('group_id').eq('user_id', toUser);
    const { data: gData } = await supabase.from('voyage_guests').select('group_id').eq('id', toUser);
    const toUserGids = [...(mData?.map(m => m.group_id) || []), ...(gData?.map(g => g.group_id) || [])];
    
    const sharedGroupId = fGroups.find(g => toUserGids.includes(g.id))?.id;
    if (!sharedGroupId) {
      alert("Could not find a shared voyage to log the payment against.");
      return;
    }

    const { error } = await supabase.from('settlement_transfers').insert([{
      group_id: sharedGroupId,
      from_user: userId,
      to_user: toUser,
      amount: amount
    }]);

    if (!error) {
      alert("Payment logged in the Ship's Vault! Adjusting ledgers...");
      window.location.reload();
    } else {
      alert("Failed to log payment.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-5xl text-secondary animate-pulse">sync</span>
          <p className="font-mono text-sm text-on-surface-variant uppercase tracking-widest">Calculating Settlements...</p>
        </div>
      </div>
    );
  }

  const hasNoDebts = settlement.youOwe.length === 0 && settlement.owedToYou.length === 0;

  return (
    <div className="max-w-4xl mx-auto w-full p-4 md:p-8">
      {/* Header */}
      <div className="py-8 border-b border-outline-variant/30 mb-8">
        <div className="flex flex-col gap-4">
          <Link
            href="/dashboard"
            className="self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-outline-variant text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-all shadow-sm group"
          >
            <span className="material-symbols-outlined text-[16px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
            Back to Dashboard
          </Link>
          <div>
            <p className="font-mono text-xs text-error uppercase tracking-widest mb-2 flex items-center gap-2 font-bold">
              <span className="material-symbols-outlined text-sm">account_balance</span>
              Final Ledger
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-primary-container tracking-tight">Settle Debts</h2>
          </div>
        </div>
      </div>

      {hasNoDebts ? (
        <div className="bg-surface-container-lowest border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-secondary mb-4">check_circle</span>
          <h4 className="font-display text-2xl font-bold text-on-surface mb-2">All Squared Up!</h4>
          <p className="text-on-surface-variant max-w-md mx-auto">
            You do not owe anyone money, and no one owes you money from any finished voyages.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          
          {/* You Owe Section */}
          {settlement.youOwe.length > 0 && (
            <div className="bg-error/5 border border-error/20 rounded-xl p-6">
              <h3 className="font-display text-2xl font-bold text-error flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined">outbox</span> You Owe
              </h3>
              <div className="flex flex-col gap-4">
                {settlement.youOwe.map((debt, idx) => (
                  <div key={idx} className="bg-surface border border-outline-variant/40 rounded-lg p-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-error/10 text-error flex items-center justify-center">
                        <span className="material-symbols-outlined">person</span>
                      </div>
                      <div>
                        <p className="font-bold text-on-surface">{debt.name}</p>
                        <p className="text-xs font-mono uppercase tracking-widest text-on-surface-variant">
                          {debt.isGuest ? 'Guest Passenger' : 'Crew Member'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <p className="font-display text-2xl font-bold text-error">
                        ₹{debt.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <button 
                        onClick={() => handleLogPayment(debt.id, debt.amount)}
                        className="mt-2 text-[10px] font-mono uppercase tracking-widest bg-error/10 text-error hover:bg-error hover:text-white px-3 py-1 rounded transition-colors border border-error/20"
                      >
                        Log Payment
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Owed To You Section */}
          {settlement.owedToYou.length > 0 && (
            <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-6">
              <h3 className="font-display text-2xl font-bold text-secondary flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined">inbox</span> Owed To You
              </h3>
              <div className="flex flex-col gap-4">
                {settlement.owedToYou.map((credit, idx) => (
                  <div key={idx} className="bg-surface border border-outline-variant/40 rounded-lg p-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                        <span className="material-symbols-outlined">person</span>
                      </div>
                      <div>
                        <p className="font-bold text-on-surface">{credit.name}</p>
                        <p className="text-xs font-mono uppercase tracking-widest text-on-surface-variant">
                          {credit.isGuest ? 'Guest Passenger' : 'Crew Member'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-2xl font-bold text-secondary">
                        ₹{credit.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
