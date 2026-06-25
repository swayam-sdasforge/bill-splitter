'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import BottomSheetTooltip from '@/components/ui/BottomSheetTooltip';

export default function DashboardOverview() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string>('🏴‍☠️');
  const [recentExpenses, setRecentExpenses] = useState<{
    id: string;
    description: string;
    amount: number;
    created_at: string;
    type: 'personal' | 'voyage';
    voyageName?: string;
    voyageId?: string;
  }[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [youOwe, setYouOwe] = useState(0);
  const [owedToYou, setOwedToYou] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoTooltipOpen, setIsLogoTooltipOpen] = useState(false);
  const [claimCode, setClaimCode] = useState('');
  const [activeGroupsCount, setActiveGroupsCount] = useState(0);
  const [voyageDiffText, setVoyageDiffText] = useState('no previous journey');
  const [achievements, setAchievements] = useState<{ badge_id: string; unlocked_at: string }[]>([]);
  const [finishedVoyages, setFinishedVoyages] = useState<{id: string, group_name: string, created_at: string}[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<{title: string, desc: string, icon: string} | null>(null);
  const [upiId, setUpiId] = useState('');
  const [qrCodePreview, setQrCodePreview] = useState<string | null>(null);
  const [isSavingUpi, setIsSavingUpi] = useState(false);
  const [dueTolls, setDueTolls] = useState<any[]>([]);
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setUserEmail(session.user.email);
        setUserName(session.user.user_metadata?.full_name || null);
      }

      if (!session) return;
      const uid = session.user.id;

      // Fetch user profile data including UPI and QR Code
      const { data: userData } = await supabase.from('users').select('name, active_avatar, upi_id, qr_code_url').eq('id', uid).maybeSingle();
      if (userData?.name) setUserName(userData.name);
      if (userData?.active_avatar) setUserAvatar(userData.active_avatar);
      if (userData?.upi_id) setUpiId(userData.upi_id);
      if (userData?.qr_code_url) setQrCodePreview(userData.qr_code_url);

      // Fetch recent personal expenses
      const { data: personalData } = await supabase
        .from('personal_expenses')
        .select('id, description, amount, created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch recent voyage (group) expenses
      const { data: groupExpData } = await supabase
        .from('group_expenses')
        .select('id, description, amount, created_at, group_id, lat, disputed_by')
        .order('created_at', { ascending: false });

      // Fetch group names for voyage expenses
      const combined: typeof recentExpenses = [];

      if (personalData) {
        personalData.forEach(e => combined.push({ ...e, type: 'personal' }));
      }

      if (groupExpData && groupExpData.length > 0) {
        const groupIds = [...new Set(groupExpData.map(e => e.group_id))];
        const { data: groupNames } = await supabase
          .from('shared_groups')
          .select('id, group_name')
          .in('id', groupIds);

        const nameMap: Record<string, string> = {};
        groupNames?.forEach(g => { nameMap[g.id] = g.group_name; });

        groupExpData.forEach(e => combined.push({
          ...e,
          type: 'voyage',
          voyageName: nameMap[e.group_id] || 'Voyage',
          voyageId: e.group_id
        }));
      }

      // Sort all by date, take 8 most recent
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      // Fetch all groups for counts and logic
      const { data: allGroups } = await supabase
        .from('shared_groups')
        .select('id, status, created_at, created_by')
        .order('created_at', { ascending: false });

      let fGroupIds: string[] = [];
      let tempOwe = 0;
      let tempOwed = 0;

      if (allGroups && allGroups.length > 0) {
        setActiveGroupsCount(allGroups.filter(g => g.status !== 'finished').length);
        
        const finishedGroups = allGroups.filter(g => g.status === 'finished');
        fGroupIds = finishedGroups.map(g => g.id);
        
        // Fetch group names for finished groups to display in archive
        const finishedGroupNames = allGroups.filter(g => g.status === 'finished').map(g => ({
          id: g.id,
          group_name: g.status === 'finished' ? 'Voyage' : '', // Fallback, will overwrite
          created_at: g.created_at
        }));
        
        if (finishedGroupNames.length > 0) {
          const { data: namesData } = await supabase.from('shared_groups').select('id, group_name, created_at').in('id', fGroupIds);
          if (namesData) {
             setFinishedVoyages(namesData.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
          }
        }

        // Voyage Difference Math
        if (allGroups.length >= 2 && finishedGroups.length > 0) {
          const latestVoyage = allGroups[0];
          const previousVoyage = allGroups.find(g => g.id !== latestVoyage.id && g.status === 'finished');
          
          if (previousVoyage) {
            const { data: latestExp } = await supabase.from('group_expenses').select('amount').eq('group_id', latestVoyage.id).eq('paid_by', uid).eq('is_disputed', false);
            const { data: prevExp } = await supabase.from('group_expenses').select('amount').eq('group_id', previousVoyage.id).eq('paid_by', uid).eq('is_disputed', false);
            
            const latestSpent = latestExp?.reduce((s, e) => s + Number(e.amount), 0) || 0;
            const prevSpent = prevExp?.reduce((s, e) => s + Number(e.amount), 0) || 0;
            
            if (prevSpent === 0 && latestSpent === 0) {
              setVoyageDiffText('0% vs last voyage');
            } else if (prevSpent === 0) {
              setVoyageDiffText('+100% vs last voyage');
            } else {
              const diff = latestSpent - prevSpent;
              const percent = Math.round((diff / prevSpent) * 100);
              setVoyageDiffText(`${percent > 0 ? '+' : ''}${percent}% vs last voyage`);
            }
          }
        }
      }

      if (fGroupIds.length > 0) {
        const { data: fExpenses } = await supabase
          .from('group_expenses')
          .select('amount, group_id, paid_by')
          .in('group_id', fGroupIds)
          .eq('is_disputed', false);

        const { data: fMembers } = await supabase
          .from('group_members')
          .select('group_id')
          .in('group_id', fGroupIds);
          
        const { data: fGuests } = await supabase
          .from('voyage_guests')
          .select('group_id')
          .in('group_id', fGroupIds);

        const { data: transfers } = await supabase
          .from('settlement_transfers')
          .select('from_user, to_user, amount')
          .in('group_id', fGroupIds);

        for (const gId of fGroupIds) {
          const groupExps = fExpenses?.filter(e => e.group_id === gId) || [];
          const totalExp = groupExps.reduce((s, e) => s + Number(e.amount), 0);
          
          const memberCount = (fMembers?.filter(m => m.group_id === gId).length || 0) + 
                              (fGuests?.filter(g => g.group_id === gId).length || 0);

          if (memberCount > 0) {
            const perPersonShare = totalExp / memberCount;
            const myPaid = groupExps.filter(e => e.paid_by === uid).reduce((s, e) => s + Number(e.amount), 0);

            const diff = myPaid - perPersonShare;
            let groupNet = diff;
            
            if (transfers) {
              const myTransfersOut = transfers.filter(t => t.from_user === uid).reduce((s, t) => s + Number(t.amount), 0);
              const myTransfersIn = transfers.filter(t => t.to_user === uid).reduce((s, t) => s + Number(t.amount), 0);
              groupNet += myTransfersOut;
              groupNet -= myTransfersIn;
            }

            if (groupNet > 0.01) tempOwed += groupNet;
            else if (groupNet < -0.01) tempOwe += Math.abs(groupNet);
          }
        }
      }

      setRecentExpenses(combined.slice(0, 8));
      const totalS = combined.reduce((s, e) => s + Number(e.amount), 0);
      setTotalSpent(totalS);
      setYouOwe(tempOwe);
      setOwedToYou(tempOwed);

      // 4. Fetch Achievements
      const { data: achData } = await supabase.from('user_achievements').select('badge_id, unlocked_at').eq('user_id', uid);
      const userBounties = achData || [];
      setAchievements(userBounties);

      // 5. Evaluate and award new Bounties asynchronously
      evaluateBounties(uid, combined, userBounties, totalS, allGroups || []);

      // 6. Fetch Due Recurring Tolls
      const today = new Date().toISOString().split('T')[0];
      const { data: recData } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('paid_by', uid)
        .lte('next_due_date', today);
      setDueTolls(recData || []);
    };

    fetchUser();
  }, []);

  const evaluateBounties = async (userId: string, allExpenses: any[], existingBounties: any[], totalSpent: number, allGroups: any[]) => {
    const existingIds = new Set(existingBounties.map(b => b.badge_id));
    const newBounties: string[] = [];

    // Bounty: First Coin (Logged at least 1 expense)
    if (allExpenses.length >= 1 && !existingIds.has('first_coin')) newBounties.push('first_coin');

    // Bounty: High Roller (Single expense > 5000)
    if (allExpenses.some(e => Number(e.amount) >= 5000) && !existingIds.has('high_roller')) newBounties.push('high_roller');

    // Bounty: Captain's Stash (Logged a personal expense)
    if (allExpenses.some(e => e.type === 'personal') && !existingIds.has('personal_stash')) newBounties.push('personal_stash');

    // Bounty: Deep Pockets (Spent over ₹10,000)
    if (totalSpent >= 10000 && !existingIds.has('deep_pockets')) newBounties.push('deep_pockets');
    
    // Bounty: Quartermaster (5+ voyage expenses)
    const voyageExps = allExpenses.filter(e => e.type === 'voyage');
    if (voyageExps.length >= 5 && !existingIds.has('quartermaster')) newBounties.push('quartermaster');

    // Bounty: Tavern Regular (3+ food/drinks expenses)
    const tavernExps = allExpenses.filter(e => e.category === 'food' || e.category === 'drinks');
    if (tavernExps.length >= 3 && !existingIds.has('tavern_regular')) newBounties.push('tavern_regular');

    // Bounty: Navigator (Logged an expense with GPS)
    if (allExpenses.some(e => e.lat) && !existingIds.has('navigator')) newBounties.push('navigator');

    // Bounty: Admiral (Created 3+ voyages)
    const myVoyages = allGroups.filter(g => g.created_by === userId);
    if (myVoyages.length >= 3 && !existingIds.has('admiral')) newBounties.push('admiral');

    // Bounty: Mutineer (Disputed an expense)
    if (allExpenses.some(e => e.disputed_by === userId) && !existingIds.has('mutineer')) newBounties.push('mutineer');

    if (newBounties.length > 0) {
      const inserts = newBounties.map(badge => ({ user_id: userId, badge_id: badge }));
      await supabase.from('user_achievements').insert(inserts);
      
      setAchievements(prev => [
        ...prev, 
        ...newBounties.map(b => ({ badge_id: b, unlocked_at: new Date().toISOString() }))
      ]);
    }
  };

  const handlePayToll = async (toll: any) => {
    const newId = crypto.randomUUID();
    let insertErr;
    if (toll.group_id) {
      const { error } = await supabase.from('group_expenses').insert([{
        id: newId,
        group_id: toll.group_id,
        paid_by: toll.paid_by,
        amount: toll.amount,
        description: toll.description,
        category: toll.category || 'other'
      }]);
      insertErr = error;
    } else {
      const { error } = await supabase.from('personal_expenses').insert([{
        id: newId,
        user_id: toll.paid_by,
        amount: toll.amount,
        description: toll.description,
        category: toll.category || 'other'
      }]);
      insertErr = error;
    }

    if (!insertErr) {
      const nextDate = new Date();
      if (toll.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
      else nextDate.setMonth(nextDate.getMonth() + 1);

      await supabase.from('recurring_expenses').update({
        next_due_date: nextDate.toISOString().split('T')[0]
      }).eq('id', toll.id);
      
      setDueTolls(prev => prev.filter(t => t.id !== toll.id));
      // Re-fetch or locally update totalSpent here if needed, but a reload is simpler for now
      window.location.reload();
    } else {
      alert("Failed to pay toll: " + insertErr.message);
    }
  };

  const handleSaveUpi = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingUpi(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { error } = await supabase.from('users').update({ 
        upi_id: upiId,
        qr_code_url: qrCodePreview
      }).eq('id', session.user.id);
      if (error) throw error;
      alert('UPI ID saved successfully! Crew mates can now Parley & Settle with you.');
    } catch (err: any) {
      alert('Error saving UPI ID: ' + err.message);
    } finally {
      setIsSavingUpi(false);
    }
  };

  const handleQrCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setQrCodePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleSendReminders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const uid = session.user.id;

    const { data: finishedGroups } = await supabase
      .from('shared_groups')
      .select('id, group_name')
      .eq('status', 'finished');

    if (!finishedGroups || finishedGroups.length === 0) {
      alert("No finished voyages to send reminders for.");
      return;
    }

    const fGroupIds = finishedGroups.map(g => g.id);
    const { data: fExpenses } = await supabase.from('group_expenses').select('amount, group_id, paid_by, paid_by_guest').in('group_id', fGroupIds).eq('is_disputed', false);
    const { data: fMembers } = await supabase.from('group_members').select('group_id, user_id').in('group_id', fGroupIds);
    const { data: fGuests } = await supabase.from('voyage_guests').select('id, group_id, guest_name').in('group_id', fGroupIds);
    
    const allUserIds = Array.from(new Set([
      ...(fMembers?.map(m => m.user_id) || []),
      ...(fExpenses?.map(e => e.paid_by).filter(Boolean) || [])
    ]));
    
    const { data: usersData } = await supabase.from('users').select('id, name').in('id', allUserIds);
    const nameMap: Record<string, string> = {};
    usersData?.forEach(u => { nameMap[u.id] = u.name || 'User'; });
    
    const guestNameMap: Record<string, string> = {};
    fGuests?.forEach(g => { guestNameMap[g.id] = g.guest_name; });

    let messagesSent = 0;

    for (const group of finishedGroups) {
      const gId = group.id;
      const groupExps = fExpenses?.filter(e => e.group_id === gId) || [];
      const totalExp = groupExps.reduce((s, e) => s + Number(e.amount), 0);
      
      const members = fMembers?.filter(m => m.group_id === gId).map(m => m.user_id) || [];
      const guests = fGuests?.filter(g => g.group_id === gId).map(g => g.id) || [];
      const allParticipants = [...members, ...guests];
      const memberCount = allParticipants.length;

      if (memberCount > 0 && totalExp > 0) {
        const perPersonShare = totalExp / memberCount;
        const groupBalances: Record<string, number> = {};
        
        allParticipants.forEach(p => { groupBalances[p] = -perPersonShare; });
        
        groupExps.forEach(exp => {
          if (exp.paid_by) {
            if (groupBalances[exp.paid_by] === undefined) groupBalances[exp.paid_by] = 0;
            groupBalances[exp.paid_by] += Number(exp.amount);
          } else if (exp.paid_by_guest) {
            if (groupBalances[exp.paid_by_guest] === undefined) groupBalances[exp.paid_by_guest] = 0;
            groupBalances[exp.paid_by_guest] += Number(exp.amount);
          }
        });

        const debtors: { id: string; balance: number }[] = [];
        const creditors: { id: string; balance: number }[] = [];

        Object.keys(groupBalances).forEach(pId => {
          const bal = groupBalances[pId];
          if (bal < -0.01) debtors.push({ id: pId, balance: Math.abs(bal) });
          else if (bal > 0.01) creditors.push({ id: pId, balance: bal });
        });

        debtors.sort((a, b) => b.balance - a.balance);
        creditors.sort((a, b) => b.balance - a.balance);

        const transfers: string[] = [];
        let d = 0;
        let c = 0;

        while (d < debtors.length && c < creditors.length) {
          const debtor = debtors[d];
          const creditor = creditors[c];
          
          const amount = Math.min(debtor.balance, creditor.balance);
          
          const debtorName = nameMap[debtor.id] || guestNameMap[debtor.id] || 'Unknown';
          const creditorName = nameMap[creditor.id] || guestNameMap[creditor.id] || 'Unknown';
          
          transfers.push(`• ${debtorName} owes ${creditorName} ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

          debtor.balance -= amount;
          creditor.balance -= amount;

          if (debtor.balance < 0.01) d++;
          if (creditor.balance < 0.01) c++;
        }

        if (transfers.length > 0) {
          const messageText = `📢 **Voyage Settlement Summary** 📢\nThis voyage has concluded. Here is the final breakdown of who owes what:\n\n${transfers.join('\n')}\n\nPlease settle your balances!`;
          
          await supabase.from('voyage_messages').insert([{
            id: crypto.randomUUID(),
            group_id: gId,
            user_id: uid,
            message: messageText
          }]);
          
          messagesSent++;
        }
      }
    }

    if (messagesSent > 0) {
      alert(`Reminders sent successfully to ${messagesSent} voyage chat room(s)!`);
    } else {
      alert("All balances are already settled, no reminders needed.");
    }
  };

  const handleClaimStowaway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimCode.trim()) return;
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const uid = session.user.id;

    const { data: guestData, error: guestError } = await supabase
      .from('voyage_guests')
      .select('id, group_id')
      .eq('claim_code', claimCode.toUpperCase().trim())
      .maybeSingle();

    if (guestError || !guestData) {
      alert("Invalid claim code or stowaway not found.");
      return;
    }

    const { id: guestId, group_id: groupId } = guestData;

    const { data: existingMember } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .eq('user_id', uid)
      .maybeSingle();

    if (!existingMember) {
      await supabase.from('group_members').insert([{ group_id: groupId, user_id: uid }]);
    }

    await supabase.from('group_expenses')
      .update({ paid_by_guest: null, paid_by: uid })
      .eq('paid_by_guest', guestId);

    await supabase.from('voyage_guests').delete().eq('id', guestId);

    const { data: ach } = await supabase.from('user_achievements').select('id').eq('user_id', uid).eq('badge_id', 'stowaway_survivor').maybeSingle();
    if (!ach) {
      await supabase.from('user_achievements').insert([{ user_id: uid, badge_id: 'stowaway_survivor' }]);
    }

    alert("Success! You have claimed your Stowaway profile and have been upgraded to full Crew Member for that voyage!");
    setClaimCode('');
    window.location.reload();
  };

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col md:flex-row selection:bg-secondary-container selection:text-on-secondary-container">
      {/* TopAppBar (Mobile Only - Hidden on Desktop) */}
      <header className="flex justify-between items-center px-gutter w-full sticky top-0 z-30 overflow-hidden border-b-2 border-outline-variant bg-background dark:bg-surface-dim h-20 md:hidden">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -ml-2 text-primary hover:text-secondary transition-all"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-2xl border border-outline-variant shadow-inner">
            {userAvatar}
          </div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile italic text-white font-extrabold animate-pulse drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">The Swayam Splitter</h1>
        </div>
        <div className="flex gap-unit">
          <button className="p-2 text-primary hover:text-secondary transition-all">
            <span className="material-symbols-outlined" data-icon="notifications">notifications</span>
          </button>
          <button className="p-2 text-primary hover:text-secondary transition-all">
            <span className="material-symbols-outlined" data-icon="sailing">sailing</span>
          </button>
        </div>
      </header>

      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SideNavBar */}
      <nav 
        className={`${isMobileMenuOpen ? 'flex animate-in slide-in-from-left duration-300 shadow-2xl' : 'hidden md:flex shadow-[4px_0_15px_-3px_rgba(88,28,135,0.08)]'} flex-col h-screen fixed left-0 top-0 z-50 md:z-40 w-72 border-r-2 border-double border-outline-variant bg-surface-container bg-cover bg-center`}
        style={{ backgroundImage: "linear-gradient(rgba(26, 24, 32, 0.85), rgba(26, 24, 32, 0.85)), url('/retro_castle_bg.png')" }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a') && window.innerWidth < 768) {
            setIsMobileMenuOpen(false);
          }
        }}
      >
        {isMobileMenuOpen && (
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden absolute top-4 right-4 text-on-surface-variant hover:text-primary z-50 bg-black/20 p-1 rounded-full border border-outline-variant/30 backdrop-blur"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
        <div className="p-container-margin border-b border-outline-variant border-dashed flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-3xl border border-outline-variant shadow-inner flex-shrink-0">
            {userAvatar}
          </div>
          <div className="min-w-0">
            <h1 className="font-headline-lg text-headline-lg font-bold text-primary">Welcome Aboard,</h1>
            <BottomSheetTooltip text={userName || userEmail || 'Stateroom 402B'}>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1 truncate">
                {userName || userEmail || 'Stateroom 402B'}
              </p>
            </BottomSheetTooltip>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-unit-8 flex flex-col gap-2 px-unit">
          {/* Active Tab */}
          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-secondary-container font-bold border-l-4 border-secondary bg-secondary-container/20 transform scale-[0.99] transition-all">
            <span className="material-symbols-outlined" data-icon="anchor">anchor</span>
            <span className="font-label-sm text-label-sm">Home</span>
          </Link>
          {/* Inactive Tabs */}
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
          <Link href="/dashboard/shop" className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:text-secondary hover:bg-secondary-container/50 transition-colors duration-300 group">
            <span className="material-symbols-outlined group-hover:text-secondary group-hover:scale-110 transition-transform" data-icon="storefront">storefront</span>
            <span className="font-label-sm text-label-sm font-bold group-hover:text-secondary">Shipwright's Shop</span>
          </Link>
        </div>
        <div className="p-container-margin border-t border-outline-variant border-dashed flex flex-col gap-3">
          <Link href="/dashboard/treasures" className="w-full bg-gradient-to-r from-amber-400 to-yellow-600 text-black border border-yellow-300 px-4 py-3 rounded text-center font-label-sm text-label-sm hover:from-amber-300 hover:to-yellow-500 transition-colors flex items-center justify-center gap-2 shadow-sm font-extrabold uppercase tracking-widest relative overflow-hidden group block">
            <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
            <span className="material-symbols-outlined text-[18px]">diamond</span>
            Treasures to explore
            <span className="material-symbols-outlined text-[18px]">diamond</span>
          </Link>
          <Link href="/dashboard/groups" className="w-full bg-[#d32f2f] dark:bg-[#b71c1c] text-white border border-[#b71c1c] dark:border-[#7f0000] px-4 py-3 rounded text-center font-label-sm text-label-sm hover:bg-[#c62828] dark:hover:bg-[#c62828] transition-colors flex items-center justify-center gap-2 ticket-btn shadow-sm relative overflow-hidden block">
            <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-surface-container rounded-full border-r border-[#b71c1c] dark:border-[#7f0000]"></div>
            <div className="flex-1 flex items-center justify-center gap-2 font-mono font-bold tracking-widest uppercase">
              <span className="material-symbols-outlined text-[18px]">add</span>New Voyage
            </div>
            <div className="h-full border-l border-dashed border-white/40 mx-2"></div>
            <div className="w-8 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px] opacity-90 transform -rotate-45">confirmation_number</span>
            </div>
            <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-surface-container rounded-full border-l border-[#b71c1c] dark:border-[#7f0000]"></div>
          </Link>
        </div>
        <div className="p-container-margin border-t border-outline-variant border-dashed">
          <div className="flex flex-col gap-2">
            <Link href="#" className="flex items-center gap-3 text-on-surface-variant hover:text-primary transition-colors text-sm">
              <span className="material-symbols-outlined text-[18px]" data-icon="lifebuoy">gif_box</span>
              <span className="font-label-sm text-label-sm">Support</span>
            </Link>
            <button onClick={handleLogout} className="flex items-center gap-3 text-red-500 font-bold hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm w-full text-left px-2 py-1.5 rounded-md">
              <span className="material-symbols-outlined text-[18px]" data-icon="logout">logout</span>
              <span className="font-label-sm text-label-sm font-bold">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 md:ml-72 flex flex-col min-h-screen relative bg-surface-dim overflow-hidden">
        {/* Background Image */}
        <div
          className="fixed inset-0 z-0 opacity-60 pointer-events-none scale-110"
          style={{ backgroundImage: "url('/image_4.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
        ></div>

        {/* Semi-transparent overlay to keep text readable */}
        <div className="fixed inset-0 z-0 bg-surface/60 pointer-events-none"></div>

        <div className="flex-1 p-gutter md:p-container-margin pb-section-gap relative z-10">
          <header className="mb-section-gap">
            <h2 className="font-display-lg text-display-lg text-primary mb-2">Captain&apos;s Ledger</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">Review your voyage expenses and current balances.</p>
          </header>

          {/* Stat Cards Bento Grid */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-section-gap">
            {/* Total Spent */}
            <div className="bg-surface-container-low border border-outline-variant rounded p-6 shadow-[0_2px_8px_-2px_rgba(0,35,71,0.05)] relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-symbols-outlined text-[64px]" data-icon="anchor">anchor</span>
              </div>
              <p className="font-label-sm text-label-sm text-on-surface-variant mb-2">Total Spent</p>
              <h3 className="font-headline-lg text-headline-lg text-primary">
                ₹{totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h3>
              <div className="mt-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center bg-tertiary-container/10 text-tertiary rounded-full px-2 py-0.5 text-xs font-bold border border-tertiary/20">
                  {voyageDiffText}
                </span>
              </div>
            </div>

            {/* Groups */}
            <Link href="/dashboard/groups" className="bg-surface-container-low border border-outline-variant rounded p-6 shadow-[0_2px_8px_-2px_rgba(0,35,71,0.05)] relative overflow-hidden group hover:border-primary transition-colors cursor-pointer block">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-symbols-outlined text-[64px]" data-icon="sailing">sailing</span>
              </div>
              <p className="font-label-sm text-label-sm text-on-surface-variant mb-2">Active Groups</p>
              <h3 className="font-headline-lg text-headline-lg text-primary">{activeGroupsCount}</h3>
              <div className="mt-4 flex items-center gap-2">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 rounded-full border border-background bg-secondary-container"></div>
                  <div className="w-6 h-6 rounded-full border border-background bg-primary-fixed-dim"></div>
                  <div className="w-6 h-6 rounded-full border border-background bg-tertiary-fixed"></div>
                </div>
              </div>
            </Link>

            {/* You Owe */}
            <div className="bg-surface-container-low border border-outline-variant rounded p-6 shadow-[0_2px_8px_-2px_rgba(0,35,71,0.05)] relative overflow-hidden group border-t-4 border-t-error">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-symbols-outlined text-[64px]" data-icon="outbox">outbox</span>
              </div>
              <p className="font-label-sm text-label-sm text-on-surface-variant mb-2">You Owe</p>
              <h3 className="font-headline-lg text-headline-lg text-error">₹{youOwe.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
              <div className="mt-4">
                <Link href="/dashboard/settle" className="text-sm font-label-sm text-error underline hover:text-error/80">Settle Debts</Link>
              </div>
            </div>

            {/* Owed to You */}
            <div className="bg-surface-container-low border border-outline-variant rounded p-6 shadow-[0_2px_8px_-2px_rgba(0,35,71,0.05)] relative overflow-hidden group border-t-4 border-t-secondary">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-symbols-outlined text-[64px]" data-icon="inbox">inbox</span>
              </div>
              <p className="font-label-sm text-label-sm text-on-surface-variant mb-2">Owed to You</p>
              <h3 className="font-headline-lg text-headline-lg text-secondary">₹{owedToYou.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
              <div className="mt-4">
                <button onClick={handleSendReminders} className="text-sm font-label-sm text-secondary underline hover:text-secondary/80">Send Reminders</button>
              </div>
            </div>
          </section>

          {/* Due Tolls (Recurring) */}
          {dueTolls.length > 0 && (
            <section className="mb-section-gap bg-error-container/20 border-2 border-error border-dashed rounded-xl p-6 shadow-sm">
              <h3 className="font-display text-2xl font-bold text-error mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined animate-bounce">notification_important</span>
                Due Tolls (Recurring)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dueTolls.map(toll => (
                  <div key={toll.id} className="bg-surface border border-error/30 rounded-lg p-4 flex items-center justify-between shadow-sm">
                    <div>
                      <p className="font-bold text-on-surface text-lg">{toll.description}</p>
                      <p className="text-sm font-mono text-on-surface-variant flex items-center gap-2 mt-1">
                        <span className="bg-error/10 text-error px-2 py-0.5 rounded uppercase">{toll.frequency}</span>
                        Due: {new Date(toll.next_due_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <span className="font-display font-bold text-primary-container text-xl">₹{Number(toll.amount).toLocaleString('en-IN')}</span>
                      <button 
                        onClick={() => handlePayToll(toll)}
                        className="bg-error text-white font-mono text-xs uppercase tracking-widest px-4 py-2 rounded hover:bg-error/80 transition-colors shadow-sm"
                      >
                        Pay Toll
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent Expenses Table (Ledger Style) */}
          <section className="bg-surface-container border-2 border-double border-outline-variant p-1 shadow-sm">
            <div className="bg-background border border-outline-variant">
              <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-highest">
                <h3 className="font-title-md text-title-md text-primary">Recent Manifest</h3>
                <Link href="/dashboard/history" className="font-label-sm text-label-sm text-primary hover:text-secondary flex items-center gap-1">
                  View All <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-outline-variant bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant">
                      <th className="p-4 font-normal">Date</th>
                      <th className="p-4 font-normal">Description</th>
                      <th className="p-4 font-normal">Voyage</th>
                      <th className="p-4 font-normal text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="font-body-md text-body-md">
                    {recentExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-on-surface-variant">
                          <span className="material-symbols-outlined text-3xl block mb-2 opacity-40">receipt_long</span>
                          No expenses recorded yet
                        </td>
                      </tr>
                    ) : (
                      recentExpenses.map((exp) => (
                        <tr key={exp.id} className="border-b border-outline-variant border-dashed hover:bg-surface-container-low transition-colors">
                          <td className="p-4 text-on-surface-variant text-sm">
                            {new Date(exp.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </td>
                          <td className="p-4 text-primary font-medium">{exp.description}</td>
                          <td className="p-4">
                            {exp.type === 'voyage' ? (
                              <Link href={`/dashboard/groups/${exp.voyageId}`} className="inline-flex items-center gap-1 bg-secondary-container/30 px-2 py-1 rounded text-sm border border-secondary/20 hover:border-secondary/60 transition-colors">
                                <span className="material-symbols-outlined text-[14px]">sailing</span>
                                {exp.voyageName}
                              </Link>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-primary-fixed/50 px-2 py-1 rounded text-sm border border-primary/10">
                                <span className="material-symbols-outlined text-[14px]">person</span> Personal
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right font-bold text-primary-container">
                            ₹{Number(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Captain's Quarters (Profile) */}
          <section className="mb-section-gap">
            <div className="bg-surface-container border-2 border-outline-variant rounded-xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
              <div>
                <h3 className="font-display text-2xl font-bold text-primary mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">account_balance_wallet</span>
                  Captain&apos;s Quarters (Payment Profile)
                </h3>
                <p className="text-on-surface-variant max-w-lg">
                  Set your UPI ID so that crew mates can easily &quot;Parley &amp; Settle&quot; their debts with you using a scannable QR Code.
                </p>
              </div>
              <form onSubmit={handleSaveUpi} className="flex flex-col gap-4 w-full md:w-auto mt-4 md:mt-0">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input 
                    type="text" 
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g. username@okhdfcbank" 
                    className="bg-background border border-outline-variant rounded-lg px-4 py-3 font-mono text-on-surface w-full sm:w-64 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                  <div className="relative w-full sm:w-auto">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleQrCodeChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <button type="button" className="bg-surface-container-high text-on-surface border border-outline-variant px-4 py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-surface-container-highest transition-colors w-full whitespace-nowrap">
                      <span className="material-symbols-outlined text-[20px]">qr_code</span>
                      {qrCodePreview ? 'Change QR' : 'Upload QR'}
                    </button>
                  </div>
                  <button 
                    type="submit"
                    disabled={isSavingUpi}
                    className="bg-secondary text-white px-6 py-3 rounded-lg font-bold uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap w-full sm:w-auto"
                  >
                    {isSavingUpi ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
                {qrCodePreview && (
                  <div className="flex items-center gap-4 bg-background border border-outline-variant p-3 rounded-lg">
                    <img src={qrCodePreview} alt="QR Code Preview" className="w-16 h-16 object-contain rounded" />
                    <div className="text-sm">
                      <p className="font-bold text-secondary flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">check_circle</span> QR Code attached</p>
                      <p className="text-on-surface-variant text-xs mt-0.5">Crew mates will see this when they settle with you.</p>
                    </div>
                    <button type="button" onClick={() => setQrCodePreview(null)} className="ml-auto text-error hover:text-error/80 p-2">
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>
                )}
              </form>
            </div>
          </section>

          {/* Stowaway Upgrade Section */}
          <section className="mb-section-gap">
            <div className="bg-surface-container-high border-2 border-outline-variant border-dashed rounded-xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
              <div>
                <h3 className="font-display text-2xl font-bold text-primary mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">luggage</span>
                  Claim a Stowaway Profile
                </h3>
                <p className="text-on-surface-variant max-w-lg">
                  Were you previously a Guest Passenger on someone else&apos;s voyage? Enter the Claim Code generated by your Captain to upgrade to a full Crew Member and merge your ledgers!
                </p>
              </div>
              <form onSubmit={handleClaimStowaway} className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                <input 
                  type="text" 
                  value={claimCode}
                  onChange={(e) => setClaimCode(e.target.value)}
                  placeholder="e.g. 7X9B2A" 
                  className="bg-background border border-outline-variant rounded-lg px-4 py-3 font-mono text-center uppercase tracking-widest text-on-surface w-full sm:w-48 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  maxLength={6}
                />
                <button 
                  type="submit"
                  disabled={claimCode.length < 5}
                  className="bg-secondary text-white px-6 py-3 rounded-lg font-bold uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap w-full sm:w-auto"
                >
                  Claim Profile
                </button>
              </form>
            </div>
          </section>

          {/* Captain's Logs Archive */}
          {finishedVoyages.length > 0 && (
            <section className="mb-section-gap">
              <h3 className="font-display text-3xl font-bold text-primary mb-6 flex items-center gap-3">
                <span className="material-symbols-outlined text-4xl text-secondary">history_edu</span>
                Captain's Logs Archive
              </h3>
              <div className="bg-surface-container-high border border-outline-variant rounded-xl p-6 shadow-inner">
                <p className="text-on-surface-variant font-body mb-4 max-w-2xl">
                  Dust off the scrolls from past adventures! These voyages have officially dropped anchor. 
                  Open the ledger to review the history or export the official PDF Captain's Log.
                </p>
                <div className="flex flex-wrap gap-4">
                  {finishedVoyages.map(voyage => (
                    <Link
                      key={voyage.id}
                      href={`/dashboard/groups/${voyage.id}`}
                      className="group relative bg-surface border-2 border-outline-variant hover:border-secondary p-4 rounded-lg flex flex-col gap-2 transition-all hover:shadow-md w-full sm:w-64"
                    >
                      <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-4xl text-secondary">menu_book</span>
                      </div>
                      <span className="font-display font-bold text-primary-container text-lg truncate">
                        {voyage.group_name}
                      </span>
                      <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
                        {new Date(voyage.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                      <div className="mt-2 text-xs font-bold text-secondary flex items-center gap-1 group-hover:underline">
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        Open Ledger
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Trophy Room (Pirate Bounties) */}
          <section className="mb-section-gap">
            <h3 className="font-display text-3xl font-bold text-primary mb-6 flex items-center gap-3">
              <span className="material-symbols-outlined text-4xl text-secondary">workspace_premium</span>
              Trophy Room (Bounties)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[
                { id: 'first_coin', name: 'First Coin', icon: 'toll', desc: 'Logged your very first expense' },
                { id: 'deep_pockets', name: 'Deep Pockets', icon: 'diamond', desc: 'Spent over ₹10,000 across all voyages' },
                { id: 'high_roller', name: 'High Roller', icon: 'payments', desc: 'Dropped over ₹5,000 on a single transaction' },
                { id: 'quartermaster', name: 'Quartermaster', icon: 'account_balance', desc: 'Logged 5 or more voyage expenses' },
                { id: 'personal_stash', name: 'Captain\'s Stash', icon: 'lock', desc: 'Logged a personal expense' },
                { id: 'tavern_regular', name: 'Tavern Regular', icon: 'sports_bar', desc: 'Paid for food or drinks 3 times' },
                { id: 'navigator', name: 'Navigator', icon: 'explore', desc: 'Dropped an anchor with GPS tracking' },
                { id: 'admiral', name: 'Admiral of the Fleet', icon: 'anchor', desc: 'Created 3 or more voyages' },
                { id: 'mutineer', name: 'Mutineer', icon: 'skull', desc: 'Disputed an expense in the ledger' },
                { id: 'stowaway_survivor', name: 'Stowaway Survivor', icon: 'luggage', desc: 'Claimed a guest profile to become a Crew Member' }
              ].map(badge => {
                const isUnlocked = achievements.some(a => a.badge_id === badge.id);
                return (
                  <div 
                    key={badge.id} 
                    className={`border-2 rounded-xl p-5 flex flex-col items-center justify-center text-center transition-all duration-500 relative overflow-hidden group ${
                      isUnlocked 
                        ? 'bg-gradient-to-br from-surface to-secondary-container/30 border-secondary/60 shadow-[0_4px_20px_-4px_rgba(88,28,135,0.3)] transform hover:-translate-y-2 hover:scale-105 hover:shadow-[0_8px_30px_-4px_rgba(88,28,135,0.5)] z-10' 
                        : 'bg-surface-container-lowest border-outline-variant/20 opacity-50 grayscale hover:opacity-80 hover:grayscale-0'
                    }`}
                  >
                    {isUnlocked && (
                      <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                    )}
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 transition-transform duration-700 ${
                      isUnlocked ? 'bg-gradient-to-tr from-secondary to-primary text-white shadow-inner group-hover:rotate-[360deg]' : 'bg-surface-container-high text-on-surface-variant'
                    }`}>
                      <span className="material-symbols-outlined text-3xl">{badge.icon}</span>
                    </div>
                    <h4 className={`font-display font-bold ${isUnlocked ? 'text-primary' : 'text-on-surface-variant'}`}>
                      {badge.name}
                    </h4>
                    <p className="text-xs text-on-surface-variant mt-1 leading-snug">{badge.desc}</p>
                    {isUnlocked && (
                      <span className="mt-2 text-[9px] font-mono uppercase tracking-widest bg-secondary/10 text-secondary px-2 py-0.5 rounded font-bold">
                        Unlocked
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Decorative Wave Divider at Bottom before footer */}
        <div className="relative h-12 w-full mt-auto">
          <div className="wave-divider h-12 w-full transform rotate-180"></div>
        </div>

        {/* Footer */}
        <footer className="bg-surface-container-highest dark:bg-inverse-surface border-t-4 border-double border-outline-variant w-full py-unit-8 flex flex-col md:flex-row justify-between items-center px-container-margin py-section-gap mt-auto z-10 relative">
          <div className="group relative font-title-md text-title-md mb-4 md:mb-0 cursor-help inline-block" onClick={() => setIsLogoTooltipOpen(!isLogoTooltipOpen)}>
            <span className="text-white font-extrabold animate-pulse drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">The Swayam Splitter</span>
            
            {/* Pop-up Tooltip */}
            <div className={`absolute bottom-full left-0 mb-4 w-80 p-5 bg-surface text-on-surface rounded-xl border-4 border-double border-outline-variant shadow-2xl transition-all duration-300 z-50 transform group-hover:-translate-y-2 ${isLogoTooltipOpen ? 'opacity-100 visible -translate-y-2' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'}`}>
              <h4 className="font-display text-lg font-bold text-primary mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">sailing</span>
                What is this vessel?
              </h4>
              <p className="text-sm font-body text-on-surface-variant mb-3">
                The Swayam Splitter is an elite, pirate-themed financial tracking and bill-splitting platform for your voyages.
              </p>
              <ul className="text-sm font-body-md space-y-1.5 text-on-surface-variant/90">
                <button onClick={() => setSelectedFeature({title: 'AI Receipt Scanning', icon: '📸', desc: 'Head over to the AI Scanner from the sidebar. Upload any receipt image or use your camera, and Gemini AI will automatically read the items and totals. It will convert the currency to INR if needed, and log the expense seamlessly into your selected voyage.'})} className="flex items-center gap-2 hover:text-secondary hover:underline transition-all text-left w-full"><span className="text-secondary">📸</span> AI Receipt Scanning</button>
                <button onClick={() => setSelectedFeature({title: 'Live Multi-Currency', icon: '🌍', desc: 'When logging expenses or scanning receipts, you can choose from currencies like USD, EUR, GBP, AUD, or JPY. The Swayam Splitter contacts open exchange rates in real-time to convert and lock the exact INR equivalent.'})} className="flex items-center gap-2 hover:text-secondary hover:underline transition-all text-left w-full"><span className="text-secondary">🌍</span> Live Multi-Currency Conversion</button>
                <button onClick={() => setSelectedFeature({title: 'Real-Time Chat Rooms', icon: '💬', desc: 'Click the Message in a Bottle on any voyage ledger to open a live chat room. Discuss expenses or mutiny with your crew instantly—messages are synced in real-time via Supabase.'})} className="flex items-center gap-2 hover:text-secondary hover:underline transition-all text-left w-full"><span className="text-secondary">💬</span> Real-Time Voyage Chat Rooms</button>
                <button onClick={() => setSelectedFeature({title: 'GPS Location Tracking', icon: '🗺️', desc: 'When dropping an expense, click the Anchor icon to attach your current coordinates. View the World Map to see all the ports and taverns where your crew has dropped coin.'})} className="flex items-center gap-2 hover:text-secondary hover:underline transition-all text-left w-full"><span className="text-secondary">🗺️</span> GPS Location Tracking</button>
                <button onClick={() => setSelectedFeature({title: 'Captain\'s Log PDF', icon: '📜', desc: 'Once a voyage concludes, mark it Finished. You can then click Export Captain\'s Log to download a beautifully formatted, pirate-themed PDF summary of all expenditures.'})} className="flex items-center gap-2 hover:text-secondary hover:underline transition-all text-left w-full"><span className="text-secondary">📜</span> Captain's Log PDF Export</button>
                <button onClick={() => setSelectedFeature({title: 'Built-in Mutiny System', icon: '☠️', desc: 'Think an expense is unfair? Click Mutiny to flag it. The captain must review it. Once resolved, the debt is settled!'})} className="flex items-center gap-2 hover:text-secondary hover:underline transition-all text-left w-full"><span className="text-secondary">☠️</span> Built-in Dispute & Mutiny System</button>
              </ul>
            </div>
          </div>
          <div className="flex gap-4 mb-4 md:mb-0">
            <Link href="/dashboard/policy" className="font-label-sm text-label-sm text-on-surface-variant hover:text-secondary transition-colors duration-200">Ship&apos;s Policy</Link>
            <Link href="/dashboard/rights" className="font-label-sm text-label-sm text-on-surface-variant hover:text-secondary transition-colors duration-200">Passenger Rights</Link>
          </div>
          <div className="font-body-md text-body-md text-on-surface dark:text-inverse-on-surface text-sm text-center md:text-right">
            © 2026 The_Swayam Fintech PVT.LTD
          </div>
        </footer>
      </main>

      {/* Feature Guidance Modal */}
      {selectedFeature && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedFeature(null)}></div>
          <div className="relative bg-surface border-4 border-double border-secondary rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl transform transition-all">
            <button 
              onClick={() => setSelectedFeature(null)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="text-center mb-6">
              <span className="text-5xl block mb-2">{selectedFeature.icon}</span>
              <h2 className="font-display text-2xl font-bold text-primary">{selectedFeature.title}</h2>
            </div>
            <div className="bg-surface-container border-2 border-outline-variant border-dashed p-5 rounded-xl">
              <p className="font-body-md text-on-surface text-lg leading-relaxed">
                {selectedFeature.desc}
              </p>
            </div>
            <div className="mt-6 flex justify-center">
              <button 
                onClick={() => setSelectedFeature(null)}
                className="bg-secondary text-white px-6 py-2 rounded-lg font-bold uppercase tracking-widest hover:bg-primary transition-colors"
              >
                Aye, Understood!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
