'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import ExpenseComments from './ExpenseComments';
import SavingsVault from './SavingsVault';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  created_at: string;
  paid_by: string | null;
  paid_by_guest?: string | null;
  is_disputed?: boolean;
  disputed_by?: string | null;
  photo_url?: string;
  split_type?: string;
  lat?: number;
  lng?: number;
};

type Group = {
  id: string;
  group_name: string;
  created_at: string;
  status?: string;
  created_by?: string;
  savings_goal?: number;
};

export default function VoyageLedgerPage() {
  const params = useParams();
  const groupId = params.id as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [guests, setGuests] = useState<Record<string, { name: string, code: string | null }>>({});
  const [members, setMembers] = useState<Record<string, string>>({});
  const [memberAvatars, setMemberAvatars] = useState<Record<string, string>>({});
  const [captainName, setCaptainName] = useState<string>('Captain');

  // Parley & Settle State
  const [settlements, setSettlements] = useState<{ debtorId: string, debtorName: string, creditorId: string, creditorName: string, amount: number, isGuestCreditor: boolean }[]>([]);
  const [parleyUser, setParleyUser] = useState<{ id: string, name: string, upiId: string | null, qrCodeUrl: string | null, amount: number, isGuest: boolean, isDebtor: boolean } | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [isFetchingUpi, setIsFetchingUpi] = useState(false);
  const [leaderboard, setLeaderboard] = useState<{ id: string, name: string, balance: number, isGuest: boolean }[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const galleryImages = expenses.filter(e => e.photo_url).map(e => ({url: e.photo_url!, desc: e.description}));

  useEffect(() => {
    const fetchLedger = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);

      // Fetch group info
      const { data: groupData, error: groupError } = await supabase
        .from('shared_groups')
        .select('*')
        .eq('id', groupId)
        .maybeSingle();

      if (groupError) {
        console.error('Group fetch error:', groupError.message);
      }
      if (groupData) {
        setGroup(groupData);
        // Fetch captain name
        if (groupData.created_by) {
          const { data: userData } = await supabase
            .from('users')
            .select('name')
            .eq('id', groupData.created_by)
            .maybeSingle();
          if (userData?.name) {
            setCaptainName(userData.name);
          }
        }
      }

      // Fetch all group members
      const { data: allMembersData } = await supabase
        .from('group_members')
        .select('user_id, users(name, active_avatar)')
        .eq('group_id', groupId);

      const memberMap: Record<string, string> = {};
      const avatarMap: Record<string, string> = {};
      const allMemberIds: string[] = [];
      if (allMembersData) {
        allMembersData.forEach((m: any) => {
          memberMap[m.user_id] = m.users?.name || 'Pirate';
          avatarMap[m.user_id] = m.users?.active_avatar || '🏴‍☠️';
          allMemberIds.push(m.user_id);
        });
        setMembers(memberMap);
        setMemberAvatars(avatarMap);
      }

      // Fetch group expenses
      const { data: expenseData, error: expenseError } = await supabase
        .from('group_expenses')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (expenseError) console.error('Expense fetch error:', expenseError.message);
      
      let allSplits: any[] = [];
      if (expenseData && expenseData.length > 0) {
        setExpenses(expenseData);
        
        // Fetch all expense splits for this group
        const expenseIds = expenseData.map((e: any) => e.id);
        const { data: splitsData } = await supabase
          .from('expense_splits')
          .select('*')
          .in('expense_id', expenseIds);
        if (splitsData) allSplits = splitsData;
      }

      // Fetch payments
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('group_id', groupId);
      const payments = paymentsData || [];

      // Fetch guests
      const { data: guestsData } = await supabase
        .from('voyage_guests')
        .select('id, guest_name, claim_code')
        .eq('group_id', groupId);
        
      const guestMap: Record<string, { name: string, code: string | null }> = {};
      const allGuestIds: string[] = [];
      if (guestsData) {
        guestsData.forEach((g: { id: string; guest_name: string; claim_code: string | null }) => {
          guestMap[g.id] = { name: g.guest_name, code: g.claim_code };
          allGuestIds.push(g.id);
        });
        setGuests(guestMap);
      }

      // Calculate Settlements
      if (expenseData) {
        const validExps = expenseData.filter(e => !e.is_disputed);
        const totalExp = validExps.reduce((s, e) => s + Number(e.amount), 0);
        const allParticipants = [...allMemberIds, ...allGuestIds];
        const memberCount = allParticipants.length;

        if (memberCount > 0 && totalExp > 0) {
          const groupBalances: Record<string, number> = {};
          
          allParticipants.forEach(p => { groupBalances[p] = 0; });
          
          validExps.forEach(exp => {
            if (exp.paid_by) {
              if (groupBalances[exp.paid_by] === undefined) groupBalances[exp.paid_by] = 0;
              groupBalances[exp.paid_by] += Number(exp.amount);
            } else if (exp.paid_by_guest) {
              if (groupBalances[exp.paid_by_guest] === undefined) groupBalances[exp.paid_by_guest] = 0;
              groupBalances[exp.paid_by_guest] += Number(exp.amount);
            }

            if (exp.split_type && exp.split_type !== 'equal') {
               const splitsForExp = allSplits.filter(s => s.expense_id === exp.id);
               splitsForExp.forEach(split => {
                   const debtorId = split.user_id || split.guest_id;
                   if (debtorId) {
                     if (groupBalances[debtorId] === undefined) groupBalances[debtorId] = 0;
                     groupBalances[debtorId] -= Number(split.amount);
                   }
               });
            } else {
               const perPersonShare = Number(exp.amount) / memberCount;
               allParticipants.forEach(p => { groupBalances[p] -= perPersonShare; });
            }
          });

          // Incorporate payments
          payments.forEach(payment => {
             const payerId = payment.payer_id || payment.payer_guest_id;
             const payeeId = payment.payee_id || payment.payee_guest_id;
             if (payerId && payeeId) {
                if (groupBalances[payerId] === undefined) groupBalances[payerId] = 0;
                if (groupBalances[payeeId] === undefined) groupBalances[payeeId] = 0;
                groupBalances[payerId] += Number(payment.amount);
                groupBalances[payeeId] -= Number(payment.amount);
             }
          });

          const debtors: { id: string; balance: number }[] = [];
          const creditors: { id: string; balance: number; isGuest: boolean }[] = [];

          Object.keys(groupBalances).forEach(pId => {
            const bal = groupBalances[pId];
            if (bal < -0.01) debtors.push({ id: pId, balance: Math.abs(bal) });
            else if (bal > 0.01) creditors.push({ id: pId, balance: bal, isGuest: allGuestIds.includes(pId) });
          });

          debtors.sort((a, b) => b.balance - a.balance);
          creditors.sort((a, b) => b.balance - a.balance);

          const newSettlements: any[] = [];
          let d = 0;
          let c = 0;

          while (d < debtors.length && c < creditors.length) {
            const debtor = debtors[d];
            const creditor = creditors[c];
            const amount = Math.min(debtor.balance, creditor.balance);
            
            const debtorName = memberMap[debtor.id] || guestMap[debtor.id]?.name || 'Unknown';
            const creditorName = memberMap[creditor.id] || guestMap[creditor.id]?.name || 'Unknown';
            
            newSettlements.push({
              debtorId: debtor.id,
              debtorName,
              creditorId: creditor.id,
              creditorName,
              amount,
              isGuestCreditor: creditor.isGuest
            });

            debtor.balance -= amount;
            creditor.balance -= amount;

            if (debtor.balance < 0.01) d++;
            if (creditor.balance < 0.01) c++;
          }
          setSettlements(newSettlements);

          const newLeaderboard: { id: string, name: string, balance: number, isGuest: boolean }[] = [];
          Object.keys(groupBalances).forEach(pId => {
            const isGuest = allGuestIds.includes(pId);
            const name = memberMap[pId] || guestMap[pId]?.name || 'Unknown';
            newLeaderboard.push({ id: pId, name, balance: groupBalances[pId], isGuest });
          });
          newLeaderboard.sort((a, b) => b.balance - a.balance);
          setLeaderboard(newLeaderboard);
        }
      }

      setLoading(false);
    };
    fetchLedger();
  }, [groupId]);

  const handleMutiny = async (expenseId: string, isDisputing: boolean) => {
    const { error } = await supabase
      .from('group_expenses')
      .update({ 
        is_disputed: isDisputing,
        disputed_by: isDisputing ? userId : null
      })
      .eq('id', expenseId);
      
    if (!error) {
      setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, is_disputed: isDisputing, disputed_by: isDisputing ? userId : null } : e));
    } else {
      alert("Failed to declare mutiny. The Admiralty blocked the request.");
    }
  };

  const handleGenerateClaimCode = async (guestId: string) => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await supabase
      .from('voyage_guests')
      .update({ claim_code: code })
      .eq('id', guestId);
    
    if (!error) {
      setGuests(prev => ({
        ...prev,
        [guestId]: { ...prev[guestId], code: code }
      }));
    } else {
      alert("Failed to generate claim code.");
    }
  };

  const handleParley = async (otherId: string, otherName: string, amount: number, isGuest: boolean, isDebtor: boolean) => {
    setIsFetchingUpi(true);
    setParleyUser({ id: otherId, name: otherName, upiId: null, qrCodeUrl: null, amount, isGuest, isDebtor });
    
    try {
      let upiIdStr = null;
      let qrCodeUrlStr = null;
      if (isGuest) {
        const { data } = await supabase.from('voyage_guests').select('upi_id, qr_code_url').eq('id', otherId).maybeSingle();
        if (data?.upi_id) upiIdStr = data.upi_id;
        if (data?.qr_code_url) qrCodeUrlStr = data.qr_code_url;
      } else {
        const { data } = await supabase.from('users').select('upi_id, qr_code_url').eq('id', otherId).maybeSingle();
        if (data?.upi_id) upiIdStr = data.upi_id;
        if (data?.qr_code_url) qrCodeUrlStr = data.qr_code_url;
      }
      
      setParleyUser({ id: otherId, name: otherName, upiId: upiIdStr, qrCodeUrl: qrCodeUrlStr, amount, isGuest, isDebtor });
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingUpi(false);
    }
  };

  const handleMarkAsSettled = async () => {
    if (!parleyUser || !userId || !groupId) return;
    setIsSettling(true);
    
    const payerId = parleyUser.isDebtor ? parleyUser.id : userId;
    const payeeId = parleyUser.isDebtor ? userId : parleyUser.id;
    
    const payerGuestId = parleyUser.isGuest && parleyUser.isDebtor ? parleyUser.id : null;
    const payeeGuestId = parleyUser.isGuest && !parleyUser.isDebtor ? parleyUser.id : null;
    
    const finalPayerId = payerGuestId ? null : payerId;
    const finalPayeeId = payeeGuestId ? null : payeeId;

    const { error } = await supabase.from('payments').insert([{
      group_id: groupId,
      payer_id: finalPayerId,
      payer_guest_id: payerGuestId,
      payee_id: finalPayeeId,
      payee_guest_id: payeeGuestId,
      amount: parleyUser.amount
    }]);

    if (!error) {
      const { data: ud } = await supabase.from('users').select('doubloons').eq('id', userId).single();
      if (ud) {
        await supabase.from('users').update({ doubloons: ud.doubloons + 50 }).eq('id', userId);
        alert(`Settled! You earned 50 Doubloons! 🪙`);
      }
      window.location.reload();
    } else {
      alert("Failed to mark as settled.");
    }
    setIsSettling(false);
  };

  const total = expenses.filter(e => !e.is_disputed).reduce((sum, e) => sum + Number(e.amount), 0);

  const exportCaptainsLog = () => {
    const doc = new jsPDF();
    
    // Add border
    doc.setDrawColor(88, 28, 135);
    doc.setLineWidth(1);
    doc.rect(5, 5, 200, 287);
    doc.rect(7, 7, 196, 283); // Double border for pirate scroll feel
    
    doc.setFontSize(28);
    doc.setTextColor(88, 28, 135); 
    doc.text("The Captain's Log", 105, 25, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text(`Voyage: ${group?.group_name || 'Unknown'}`, 14, 40);
    
    doc.setFontSize(12);
    doc.text(`Date of Record: ${new Date().toLocaleDateString('en-IN')}`, 14, 48);
    doc.text(`Total Plunder Spent: Rs ${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 14, 56);

    const tableData = expenses.map(e => [
      new Date(e.created_at).toLocaleDateString('en-IN'),
      e.description,
      (e.category || 'other').toUpperCase(),
      e.paid_by === userId ? 'You' : e.paid_by_guest ? guests[e.paid_by_guest]?.name || 'Guest' : members[e.paid_by || ''] || 'Pirate',
      `Rs ${Number(e.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      e.is_disputed ? 'Mutinied ☠️' : 'Valid ✅'
    ]);

    autoTable(doc, {
      startY: 65,
      head: [['Date', 'Description', 'Category', 'Paid By', 'Amount', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [88, 28, 135], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 245, 255] },
      styles: { cellPadding: 5, fontSize: 10, lineColor: [200, 190, 220], lineWidth: 0.1 },
      margin: { left: 14, right: 14 }
    });

    doc.save(`Captains_Log_${group?.group_name?.replace(/\s+/g, '_') || 'Voyage'}.pdf`);
  };

  const getCategoryEmoji = (cat: string) => {
    switch (cat) {
      case 'food': return '🍹';
      case 'drinks': return '🍸';
      case 'activities': return '🌊';
      case 'shopping': return '🛍️';
      default: return '🏷️';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-5xl text-secondary animate-pulse">sailing</span>
          <p className="font-mono text-sm text-on-surface-variant uppercase tracking-widest">Loading ledger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Pattern */}
      <div 
        className="fixed inset-0 z-0 opacity-20 pointer-events-none scale-110" 
        style={{ backgroundImage: "url('/image_6.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
      ></div>
      
      <div className="max-w-5xl mx-auto w-full relative z-10 p-4 md:p-8">
        {/* Header */}
      <div className="py-8 border-b border-outline-variant/30 mb-8">
        <div className="flex flex-col gap-4">
          <Link
            href="/dashboard/groups"
            className="self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-outline-variant text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-all shadow-sm group"
          >
            <span className="material-symbols-outlined text-[16px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
            Back to My Groups
          </Link>
          <div>
            <p className="font-mono text-xs text-secondary uppercase tracking-widest mb-2 flex items-center gap-2 font-bold">
              <span className="material-symbols-outlined text-sm">directions_boat</span>
              Voyage Ledger
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-primary-container tracking-tight flex items-center gap-4">
              {group?.group_name ?? 'My Voyage'}
              {group?.status === 'finished' && (
                <span className="bg-surface-container-high text-on-surface-variant text-sm px-3 py-1 rounded-full font-mono uppercase tracking-widest border border-outline-variant inline-flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">done_all</span>
                  Finished
                </span>
              )}
            </h2>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-on-surface-variant text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-secondary">sailing</span>
                <span className="font-bold text-on-surface">Captain of the Ship: {captainName}</span>
                <span className="opacity-50">·</span>
                {group ? `Established ${new Date(group.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}` : 'Voyage Ledger'}
              </p>
              {group?.status !== 'finished' && group?.id && (
                <button
                  onClick={async () => {
                    if (confirm('Are you sure you want to finish this journey? No more expenses can be added.')) {
                      const { error } = await supabase.from('shared_groups').update({ status: 'finished' }).eq('id', group.id);
                      if (!error) setGroup({ ...group, status: 'finished' });
                    }
                  }}
                  className="text-xs font-mono uppercase tracking-widest bg-error/10 text-error px-3 py-1 rounded hover:bg-error hover:text-white transition-colors border border-error/20"
                >
                  Finish Journey
                </button>
              )}
              {group?.status === 'finished' && (
                <button
                  onClick={exportCaptainsLog}
                  className="text-xs font-mono uppercase tracking-widest bg-secondary text-white px-3 py-1.5 rounded hover:bg-primary transition-colors border border-secondary shadow-sm flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  Export Captain's Log
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-4 bg-surface-container px-4 py-3 rounded-lg border border-outline-variant/30 inline-flex w-fit">
            <span className="font-mono text-xs uppercase text-on-surface-variant font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">key</span>
              Invite Code:
            </span>
            <div className="flex items-center gap-2">
              <code className="font-mono text-xs text-primary font-bold tracking-wider select-all">{groupId}</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(groupId as string);
                  alert("Invite Code copied to clipboard!");
                }}
                className="text-on-surface-variant hover:text-secondary transition-colors p-1 rounded-full hover:bg-surface-container-high"
                title="Copy Invite Code"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
              </button>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Link href={`/dashboard/groups/${groupId}/kraken`} title="Spin the cursed wheel to decide who pays the next toll or walks the plank!" className="flex-1 sm:flex-none flex items-center justify-center gap-2 mt-4 ml-0 bg-error/10 text-error px-4 py-3 rounded-lg border border-error/30 hover:bg-error hover:text-on-error transition-all font-bold font-mono text-xs uppercase tracking-widest shadow-sm">
              <span className="material-symbols-outlined text-[16px]">casino</span>
              The Kraken's Wheel
            </Link>
            <Link href={`/dashboard/groups/${groupId}/map`} title="View the Treasure Map analytics for this voyage!" className="flex-1 sm:flex-none flex items-center justify-center gap-2 mt-4 ml-0 bg-secondary-container/20 text-secondary px-4 py-3 rounded-lg border border-secondary/30 hover:bg-secondary-container hover:text-on-secondary-container transition-all font-bold font-mono text-xs uppercase tracking-widest shadow-sm">
              <span className="material-symbols-outlined text-[16px]">map</span>
              Treasure Map
            </Link>
          </div>
        </div>
      </div>

      {/* Buried Treasure (Savings Vault) */}
      <SavingsVault 
        groupId={groupId} 
        userId={userId} 
        isCaptain={group?.created_by === userId} 
        savingsGoal={group?.savings_goal || 0}
        onGoalUpdated={(newGoal) => setGroup(prev => prev ? { ...prev, savings_goal: newGoal } : null)}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-secondary text-white rounded-xl p-5 flex flex-col gap-1 shadow-md">
          <span className="font-mono text-xs uppercase tracking-widest opacity-80">Total Spent</span>
          <span className="font-display text-3xl font-bold">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="bg-surface-container-high rounded-xl p-5 flex flex-col gap-1 border border-outline-variant/50">
          <span className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">Entries</span>
          <span className="font-display text-3xl font-bold text-primary-container">{expenses.length}</span>
        </div>
        <div className="bg-surface-container-high rounded-xl p-5 flex flex-col gap-1 border border-outline-variant/50">
          <span className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">Your Balance</span>
          {group?.status !== 'finished' ? (
            <span className="font-display text-xl font-bold text-yellow-200 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">sailing</span> Currently in journey
            </span>
          ) : (
            <span className="font-display text-2xl font-bold text-red-600 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">warning</span> Not Settled
            </span>
          )}
        </div>
      </div>

      {/* Letters of Marque (Voyage Budget) */}
      {group?.budget && (
        <div className="mb-8 bg-surface border border-outline-variant rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display text-2xl font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">description</span> Letters of Marque (Budget)
            </h3>
            <span className={`font-mono text-xs uppercase tracking-widest font-bold px-3 py-1 rounded-full ${total > group.budget ? 'bg-error/10 text-error' : total > group.budget * 0.75 ? 'bg-orange-500/10 text-orange-500' : 'bg-secondary/10 text-secondary'}`}>
              {total > group.budget ? 'Sinking!' : total > group.budget * 0.75 ? 'Rough Seas' : 'Smooth Sailing'}
            </span>
          </div>
          <div className="flex justify-between font-mono text-xs text-on-surface-variant uppercase mb-4">
            <span>Spent: ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</span>
            <span>Limit: ₹{group.budget.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</span>
          </div>
          <div className="w-full h-8 bg-surface-container-high rounded-full overflow-hidden relative border border-outline-variant/30 shadow-inner">
            <div 
              className={`h-full ${total > group.budget ? 'bg-error' : total > group.budget * 0.75 ? 'bg-orange-500' : 'bg-secondary'} transition-all duration-1000 ease-out relative`}
              style={{ width: `${Math.min(total / group.budget * 100, 100)}%` }}
            >
              <div className="absolute inset-0 opacity-30 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHBhdGggZD0iTTAgMTBRNSAxNSAxMCAxMFQyMCAxMFIxMCAxMFE1IDE1IDAgMTBaIiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==')] animate-pulse"></div>
            </div>
            {total > group.budget && (
              <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-xs uppercase tracking-widest pointer-events-none drop-shadow-md">
                Over Budget by ₹{(total - group.budget).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
              </div>
            )}
            <div className="absolute top-0 bottom-0 left-0 flex items-center pl-2 pointer-events-none">
              <span className={`material-symbols-outlined text-[16px] ${total > group.budget ? 'text-white' : 'text-surface-container-high'} opacity-80 mix-blend-difference`}>sailing</span>
            </div>
          </div>
        </div>
      )}

      {/* Honor & Infamy Board */}
      {leaderboard.length > 0 && (
        <div className="mb-8 bg-surface-container-highest border border-outline-variant/40 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <span className="material-symbols-outlined text-8xl">military_tech</span>
          </div>
          <h3 className="font-display text-2xl font-bold text-primary mb-6 flex items-center gap-2 relative z-10">
            <span className="material-symbols-outlined text-secondary">workspace_premium</span> Honor &amp; Infamy Board
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
            {leaderboard.map((user, idx) => {
              const isMostHonorable = idx === 0 && user.balance > 0;
              const isScallywag = idx === leaderboard.length - 1 && user.balance < 0;
              return (
                <div key={user.id} className={`flex items-center gap-3 p-4 rounded-xl border ${isMostHonorable ? 'bg-secondary/10 border-secondary shadow-[0_0_15px_rgba(255,215,0,0.2)]' : isScallywag ? 'bg-error/10 border-error border-dashed relative overflow-hidden' : 'bg-surface border-outline-variant'}`}>
                  {isScallywag && (
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIxMDAlIj48cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJyZ2JhKDAsMCwwLDAuMikiLz48L3N2Zz4=')] pointer-events-none opacity-40"></div>
                  )}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-3xl shadow-inner ${isMostHonorable ? 'bg-secondary/20 border-2 border-secondary' : isScallywag ? 'bg-error/20 border-2 border-error border-dashed' : 'bg-surface-container-high border border-outline-variant'}`}>
                    {user.isGuest ? '👤' : memberAvatars[user.id] || '🏴‍☠️'}
                  </div>
                  <div className="flex-1 relative z-10">
                    <p className={`font-bold ${isMostHonorable ? 'text-secondary' : isScallywag ? 'text-error' : 'text-on-surface'}`}>{user.name}</p>
                    <p className="text-xs text-on-surface-variant font-mono">
                      {isMostHonorable ? 'Honorable Merchant' : isScallywag ? 'The Scallywag' : 'Crew Member'}
                    </p>
                  </div>
                  <div className="text-right relative z-10 flex flex-col items-end gap-1">
                    <p className={`font-display font-bold text-lg ${user.balance > 0 ? 'text-secondary' : user.balance < 0 ? 'text-error' : 'text-on-surface-variant'}`}>
                      {user.balance > 0 ? '+' : ''}{user.balance < 0 ? '-' : ''}₹{Math.abs(user.balance).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                    {user.isGuest && user.balance < -0.01 && guests[user.id]?.code && (
                      <button 
                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/pay/${guests[user.id].code}`)}
                        className="text-[10px] uppercase font-mono tracking-wider bg-surface border border-outline-variant text-on-surface-variant px-2 py-1 rounded hover:bg-surface-container-high transition-colors flex items-center gap-1"
                        title="Copy Smuggler's Link for this guest"
                      >
                        <span className="material-symbols-outlined text-[12px]">link</span>
                        Smuggler's Link
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settlements Board */}
      {settlements.length > 0 && (
        <div className="mb-8 bg-surface-container-low border border-outline-variant/40 rounded-xl p-4 shadow-sm">
          <h3 className="font-display text-xl font-bold text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">handshake</span> Parley &amp; Settle (Debts)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {settlements.map((s, idx) => (
              <div key={idx} className="bg-background border border-outline-variant/30 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1">
                    <span className={`font-bold ${s.debtorId === userId ? 'text-error' : 'text-on-surface'}`}>{s.debtorId === userId ? 'You' : s.debtorName}</span>
                    <span className="text-on-surface-variant text-sm mx-1">owe</span>
                    <span className={`font-bold ${s.creditorId === userId ? 'text-secondary' : 'text-on-surface'}`}>{s.creditorId === userId ? 'You' : s.creditorName}</span>
                  </div>
                  <span className="font-display font-bold text-lg text-primary-container">₹{s.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {s.debtorId === userId && (
                    <button 
                      onClick={() => handleParley(s.creditorId, s.creditorName, s.amount, s.isGuestCreditor, false)}
                      className="text-xs uppercase font-mono tracking-wider bg-secondary text-white px-3 py-1.5 rounded hover:bg-primary transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">qr_code_scanner</span>
                      Parley
                    </button>
                  )}
                  {s.creditorId === userId && (
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => handleParley(s.debtorId, s.debtorName, s.amount, !allMemberIds.includes(s.debtorId), true)}
                        className="text-[10px] uppercase font-mono tracking-wider bg-secondary text-white px-3 py-1.5 rounded hover:bg-primary transition-colors flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">handshake</span>
                        Settle Up
                      </button>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Ahoy ${s.debtorName}! Ye owe me ₹${s.amount.toFixed(2)} for our voyage. Pay up or ye'll be walkin' the plank! 🏴‍☠️`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] uppercase font-mono tracking-wider bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">chat</span>
                        Send Bottle
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stowaways (Guests) List */}
      {Object.keys(guests).length > 0 && (
        <div className="mb-8 bg-surface border border-outline-variant/40 rounded-xl p-4">
          <h3 className="font-display text-xl font-bold text-primary-container mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined">luggage</span> Stowaways (Guests)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Object.keys(guests).map(guestId => {
              const guest = guests[guestId];
              return (
                <div key={guestId} className="bg-surface-container-low border border-outline-variant/50 rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary">person</span>
                    <span className="font-bold text-on-surface">{guest.name}</span>
                  </div>
                  {group?.created_by === userId && (
                    <div className="mt-2 pt-2 border-t border-outline-variant/30 flex items-center justify-between">
                      {guest.code ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-on-surface-variant">Claim Code:</span>
                          <code className="text-xs font-mono bg-secondary/10 text-secondary px-2 py-0.5 rounded font-bold">{guest.code}</code>
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleGenerateClaimCode(guestId)}
                          className="text-[10px] uppercase font-mono tracking-wider bg-secondary text-white px-2 py-1 rounded hover:bg-primary transition-colors"
                        >
                          Generate Code
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Expense CTA */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="font-display text-2xl font-bold text-primary-container">Expense Log</h3>
          {galleryImages.length > 0 && (
            <button 
              onClick={() => setShowGallery(true)}
              className="bg-secondary/20 text-secondary border border-secondary/50 hover:bg-secondary hover:text-white transition-colors font-mono text-xs uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">photo_library</span>
              Plunder Gallery
            </button>
          )}
        </div>
        {group?.status !== 'finished' && (
          <Link
            href="/dashboard/expenses"
            className="inline-flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider hover:bg-primary-container transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add Entry
          </Link>
        )}
      </div>

      {/* Expenses List */}
      {expenses.length === 0 ? (
        <div className="bg-surface-container-lowest border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-outline mb-4">receipt_long</span>
          <h4 className="font-display text-xl font-bold text-on-surface mb-2">No entries yet</h4>
          <p className="text-on-surface-variant mb-4">Start logging expenses for this voyage.</p>
          {group?.status !== 'finished' && (
            <Link
              href="/dashboard/expenses"
              className="inline-flex items-center gap-2 bg-secondary text-white px-5 py-2.5 rounded-lg font-mono text-xs uppercase tracking-wider hover:bg-primary-container transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add First Entry
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {expenses.map((expense, index) => (
            <div
              key={expense.id}
              className={`bg-surface border ${expense.is_disputed ? 'border-error/50 bg-error/5' : 'border-outline-variant/40 hover:border-secondary/50 hover:shadow-sm'} rounded-xl p-4 flex flex-col transition-all group`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-lg flex-shrink-0">
                  {getCategoryEmoji(expense.category)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`font-body font-bold ${expense.is_disputed ? 'text-error line-through opacity-70' : 'text-on-surface'}`}>
                      {expense.description}
                    </p>
                    {expense.split_type && expense.split_type !== 'equal' && (
                      <span className="text-[10px] font-mono uppercase tracking-widest bg-secondary/10 text-secondary border border-secondary/20 px-1.5 py-0.5 rounded-sm flex items-center gap-1" title={`Custom Split: ${expense.split_type}`}>
                        <span className="material-symbols-outlined text-[12px]">balance</span>
                        {expense.split_type}
                      </span>
                    )}
                    {expense.photo_url && (
                      <button onClick={() => setShowGallery(true)} className="text-secondary hover:text-primary transition-colors flex items-center" title="View in Plunder Gallery">
                        <span className="material-symbols-outlined text-[16px]">image</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant font-mono flex items-center gap-2 mt-0.5">
                    <span className="uppercase">{expense.category}</span>
                    <span>·</span>
                    <span>{new Date(expense.created_at).toLocaleDateString('en-IN')}</span>
                    {expense.paid_by === userId ? (
                      <span className="text-secondary font-bold">· You paid</span>
                    ) : expense.paid_by_guest ? (
                      <span className="text-secondary font-bold">· Paid by {guests[expense.paid_by_guest]?.name || 'Guest'}</span>
                    ) : expense.paid_by ? (
                      <span className="text-secondary font-bold">· Paid by {members[expense.paid_by] || 'member'}</span>
                    ) : null}
                  </p>
                </div>
              </div>
                <div className="text-right flex flex-col items-end">
                  <p className={`font-display font-bold ${expense.is_disputed ? 'text-error line-through opacity-70' : 'text-primary-container'} text-lg`}>
                    ₹{Number(expense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-on-surface-variant font-mono">Entry #{String(index + 1).padStart(2, '0')}</p>
                    
                    {expense.is_disputed ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-error text-white px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                          🏴‍☠️ Mutiny
                        </span>
                        {group?.created_by === userId && (
                          <button 
                            onClick={() => handleMutiny(expense.id, false)}
                            className="text-[10px] bg-secondary/20 text-secondary border border-secondary/50 px-2 py-0.5 rounded uppercase tracking-wider hover:bg-secondary hover:text-white transition-colors"
                          >
                            Quell
                          </button>
                        )}
                      </div>
                    ) : group?.status !== 'finished' && (
                      <button 
                        onClick={() => handleMutiny(expense.id, true)}
                        title="Dispute this expense! It will be struck from the ledger and excluded from all final settlement math until the Captain resolves it."
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-error border border-error/50 px-2 py-0.5 rounded uppercase tracking-wider hover:bg-error hover:text-white transition-all"
                      >
                        Mutiny
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <ExpenseComments expenseId={expense.id} userId={userId} currentUserName={userId && members[userId] ? members[userId] : 'Pirate'} />
            </div>
          ))}
        </div>
      )}

      {/* Parley Modal */}
      {parleyUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-container border-2 border-double border-outline-variant rounded-xl p-6 md:p-8 w-full max-w-sm shadow-2xl relative flex flex-col items-center text-center">
            <button 
              onClick={() => setParleyUser(null)} 
              className="absolute top-4 right-4 text-on-surface-variant hover:text-error transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="font-display text-2xl font-bold text-primary mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">handshake</span> Parley
            </h3>
            <p className="font-body text-on-surface-variant mb-6">
              Settle your debt of <span className="font-bold text-error">₹{parleyUser.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span> with {parleyUser.name}.
            </p>
            
            {isFetchingUpi ? (
              <div className="w-48 h-48 bg-background border border-outline-variant/30 rounded-lg flex items-center justify-center mb-6">
                <span className="material-symbols-outlined animate-spin text-secondary text-3xl">autorenew</span>
              </div>
            ) : parleyUser.qrCodeUrl ? (
              <div className="mb-6 flex flex-col items-center">
                <div className="w-56 h-56 bg-white p-2 rounded-lg border-4 border-double border-secondary/50 flex items-center justify-center">
                  <img 
                    src={parleyUser.qrCodeUrl} 
                    alt={`Custom QR Code for ${parleyUser.name}`}
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="mt-3 font-mono text-xs uppercase tracking-widest text-secondary font-bold">Scan this custom QR code</p>
                {parleyUser.upiId && <code className="mt-1 text-xs text-on-surface-variant opacity-70">{parleyUser.upiId}</code>}
              </div>
            ) : parleyUser.upiId ? (
              <div className="mb-6 flex flex-col items-center">
                <div className="w-56 h-56 bg-white p-2 rounded-lg border-4 border-double border-secondary/50 flex items-center justify-center">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=${encodeURIComponent(parleyUser.upiId)}&pn=${encodeURIComponent(parleyUser.name)}&am=${parleyUser.amount}&cu=INR`} 
                    alt={`UPI QR Code for ${parleyUser.name}`}
                    className="w-full h-full"
                  />
                </div>
                <p className="mt-3 font-mono text-xs uppercase tracking-widest text-secondary font-bold">Scan with any UPI app</p>
                <code className="mt-1 text-xs text-on-surface-variant opacity-70">{parleyUser.upiId}</code>
              </div>
            ) : (
              <div className="w-full bg-error/10 border border-error/20 p-4 rounded-lg mb-6 flex flex-col items-center text-center">
                <span className="material-symbols-outlined text-error text-3xl mb-2">money_off</span>
                <p className="text-sm font-bold text-error">No UPI ID Found!</p>
                <p className="text-xs text-error/80 mt-1">
                  {parleyUser.name} hasn't set up their Captain's Quarters Payment Profile yet. You'll have to settle via cash or ask them to update their profile!
                </p>
              </div>
            )}
            
            <div className="w-full grid grid-cols-2 gap-2">
              <button 
                onClick={handleMarkAsSettled} 
                disabled={isSettling}
                className="w-full bg-secondary text-white font-bold uppercase tracking-widest py-2 rounded-lg hover:bg-primary transition-colors text-xs flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {isSettling ? 'Marking...' : 'Mark as Settled'}
              </button>
              <button 
                onClick={() => setParleyUser(null)} 
                className="w-full bg-surface text-on-surface font-bold uppercase tracking-widest py-2 rounded-lg border border-outline-variant hover:bg-surface-container-high transition-colors text-xs flex items-center justify-center"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plunder Gallery Modal */}
      {showGallery && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-surface-container border-2 border-double border-outline-variant rounded-xl p-6 w-full max-w-4xl shadow-2xl relative flex flex-col h-[80vh]">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="font-display text-2xl font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">photo_library</span> Plunder Gallery
              </h3>
              <button 
                onClick={() => setShowGallery(false)} 
                className="text-on-surface-variant hover:text-error transition-colors"
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {galleryImages.map((img, i) => (
                <div key={i} className="bg-background rounded-lg border border-outline-variant/30 overflow-hidden flex flex-col shadow-sm group">
                  <div className="h-48 bg-surface-container-highest relative flex items-center justify-center overflow-hidden">
                    <img src={img.url} alt={img.desc} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 p-2" />
                  </div>
                  <div className="p-3 border-t border-outline-variant/30">
                    <p className="font-bold text-sm text-on-surface truncate">{img.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
