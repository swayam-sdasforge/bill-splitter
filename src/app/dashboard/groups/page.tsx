'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import BottomSheetTooltip from '@/components/ui/BottomSheetTooltip';
import Link from 'next/link';

type Group = {
  id: string;
  group_name: string;
  created_at: string;
  status?: string;
};

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupTotals, setGroupTotals] = useState<Record<string, number>>({});
  const [groupName, setGroupName] = useState('');
  const [budget, setBudget] = useState('');
  const [guestInput, setGuestInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGroups = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);

      // Sync user into public.users table
      await supabase.from('users').upsert({
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.user_metadata?.full_name || 'User'
      });

      const { data: groupsData } = await supabase
        .from('shared_groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (groupsData) {
        setGroups(groupsData);

        // Fetch expense totals for each group
        const totals: Record<string, number> = {};
        await Promise.all(
          groupsData.map(async (g: Group) => {
            const { data: expData } = await supabase
              .from('group_expenses')
              .select('amount')
              .eq('group_id', g.id);
            totals[g.id] = expData
              ? expData.reduce((sum: number, e: { amount: number }) => sum + Number(e.amount), 0)
              : 0;
          })
        );
        setGroupTotals(totals);
      }
    };
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || !userId) return;
    setLoading(true);
    setError(null);

    // Generate a UUID client-side so we don't need .select() after insert
    // (.select() triggers the shared_groups SELECT policy which queries group_members recursively)
    const newId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { error: groupError } = await supabase
      .from('shared_groups')
      .insert([{ 
        id: newId, 
        group_name: groupName.trim(), 
        created_by: userId,
        budget: budget ? parseFloat(budget) : null
      }]);

    if (groupError) {
      setError('Failed to create voyage: ' + groupError.message);
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase
      .from('group_members')
      .insert([{ group_id: newId, user_id: userId }]);

    if (memberError) {
      setError('Voyage created but could not add you as member: ' + memberError.message);
    } else {
      const guests = guestInput.split(',').map(n => n.trim()).filter(n => n.length > 0);
      if (guests.length > 0) {
        const guestInserts = guests.map(guest_name => ({
          group_id: newId,
          guest_name
        }));
        const { error: guestError } = await supabase
          .from('voyage_guests')
          .insert(guestInserts);
        if (guestError) {
          console.error("Failed to add guests:", guestError);
        }
      }

      // Manually construct the new group object without needing a SELECT
      setGroups(prev => [{ id: newId, group_name: groupName.trim(), created_at: now }, ...prev]);
      setGroupName('');
      setBudget('');
      setGuestInput('');
    }

    setLoading(false);
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim() || !userId) return;
    setJoinLoading(true);
    setError(null);

    const code = inviteCode.trim();
    
    // Try to insert into group_members
    const { error: memberError } = await supabase
      .from('group_members')
      .insert([{ group_id: code, user_id: userId }]);

    if (memberError) {
      if (memberError.code === '23505') {
        setError('You are already a passenger on this voyage!');
      } else if (memberError.code === '23503') {
        setError('Invalid Invite Code. Voyage not found.');
      } else if (memberError.code === '22P02') {
        setError('Invalid Invite Code format. Must be a valid key.');
      } else {
        setError('Failed to join voyage: ' + memberError.message);
      }
      setJoinLoading(false);
      return;
    } 

    // Success! Now we CAN select the group because we are a member
    const { data: groupData } = await supabase
      .from('shared_groups')
      .select('id, group_name, created_at, status')
      .eq('id', code)
      .single();

    if (groupData && !groups.some(g => g.id === code)) {
      setGroups(prev => [{ id: groupData.id, group_name: groupData.group_name, created_at: groupData.created_at, status: groupData.status }, ...prev]);
      
      // Fetch totals
      const { data: expData } = await supabase
        .from('group_expenses')
        .select('amount')
        .eq('group_id', code);
        
      const total = expData ? expData.reduce((sum: number, exp: { amount: number }) => sum + Number(exp.amount), 0) : 0;
      setGroupTotals(prev => ({ ...prev, [code]: total }));
    }
    
    setInviteCode('');
    alert('Successfully joined the voyage!');
    setJoinLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('shared_groups').delete().eq('id', id);
    if (!error) {
      setGroups(groups.filter(g => g.id !== id));
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <video
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover opacity-30 scale-110"
        >
          <source src="/make_a_second_video_where_wi.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="max-w-7xl mx-auto w-full relative z-10">
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
            <p className="font-mono text-xs text-secondary uppercase tracking-widest mb-2 flex items-center gap-2 font-bold">
              <span className="material-symbols-outlined text-sm">map</span>
              Passenger Manifests
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-primary-container tracking-tight">My Groups</h2>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-lg border border-error/30 flex items-center gap-2">
          <span className="material-symbols-outlined text-error">error</span>
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="w-full flex flex-col xl:flex-row gap-8">

        {/* Left Column: Create New Group */}
        <div className="xl:w-1/3 flex flex-col gap-6">
          <div className="bg-surface-container-high p-6 rounded-xl border border-outline-variant/50 shadow-sm relative">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <span className="material-symbols-outlined text-6xl">description</span>
            </div>
            <h3 className="font-display text-2xl font-bold text-primary-container mb-6 flex items-center gap-2 border-b border-outline-variant/50 pb-2">
              <span className="material-symbols-outlined">add_circle</span>
              Draft New Voyage
            </h3>
            <form onSubmit={handleCreateGroup} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="font-mono text-xs text-on-surface-variant uppercase font-bold" htmlFor="trip-name">
                  Voyage Designation
                </label>
                <input
                  id="trip-name"
                  type="text"
                  placeholder="e.g., Caribbean Cruise"
                  className="bg-surface border border-outline-variant rounded-lg px-4 py-3 text-on-surface text-base focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary transition-all placeholder:text-outline-variant w-full"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <label className="block font-mono text-xs text-on-surface-variant uppercase mb-1 font-bold">Max Plunder (Budget)</label>
                <input 
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 50000 (optional)"
                  className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-3 text-on-surface text-base focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary transition-all placeholder:text-outline-variant"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
                <p className="text-[10px] text-on-surface-variant mt-1 font-mono uppercase">Set a limit to track how much of the ship is sinking.</p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-mono text-xs text-on-surface-variant uppercase font-bold" htmlFor="guest-names">
                  Fellow Passengers (Optional)
                </label>
                <input
                  id="guest-names"
                  type="text"
                  placeholder="e.g., John, Mary, Arthur"
                  className="bg-surface border border-outline-variant rounded-lg px-4 py-3 text-on-surface text-base focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary transition-all placeholder:text-outline-variant w-full"
                  value={guestInput}
                  onChange={(e) => setGuestInput(e.target.value)}
                />
                <p className="text-[10px] text-on-surface-variant/80">Comma separated names of people joining you.</p>
              </div>
              <button
                type="submit"
                disabled={loading || !groupName.trim()}
                className="w-full bg-secondary text-white py-3 px-6 rounded-lg font-mono text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-primary-container transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed font-bold"
              >
                <span className="material-symbols-outlined">history_edu</span>
                {loading ? 'Establishing...' : 'Establish Charter'}
              </button>
            </form>
          </div>

          <div className="bg-surface-container p-6 rounded-xl border border-outline-variant/50 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <span className="material-symbols-outlined text-6xl">group_add</span>
            </div>
            <h3 className="font-display text-2xl font-bold text-primary mb-6 flex items-center gap-2 border-b border-outline-variant/50 pb-2">
              <span className="material-symbols-outlined">link</span>
              Join Existing Voyage
            </h3>
            <form onSubmit={handleJoinGroup} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="font-mono text-xs text-on-surface-variant uppercase font-bold" htmlFor="invite-code">
                  Invite Code
                </label>
                <input
                  id="invite-code"
                  type="text"
                  placeholder="Paste voyage code here"
                  className="bg-background border border-outline-variant rounded-lg px-4 py-3 text-on-surface text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder:text-outline-variant w-full font-mono"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={joinLoading || !inviteCode.trim()}
                className="w-full bg-primary text-on-primary py-3 px-6 rounded-lg font-mono text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-primary-container transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed font-bold"
              >
                <span className="material-symbols-outlined">group_add</span>
                {joinLoading ? 'Joining...' : 'Join Voyage'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Groups Grid */}
        <div className="xl:w-2/3 flex flex-col gap-6">
          <div className="flex justify-between items-end border-b border-outline-variant/30 pb-2">
            <h3 className="font-display text-2xl font-bold text-primary-container">Active Charters</h3>
            <span className="font-mono text-xs text-on-surface-variant">{groups.length} voyage{groups.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {groups.length === 0 ? (
              <div
                onClick={() => document.getElementById('trip-name')?.focus()}
                className="col-span-full bg-surface-container-lowest border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center p-8 text-center hover:border-secondary hover:bg-surface-container transition-all cursor-pointer group min-h-[300px]"
              >
                <div className="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <span className="material-symbols-outlined text-outline text-3xl group-hover:text-secondary">add_location_alt</span>
                </div>
                <h4 className="font-display text-2xl font-bold text-on-surface mb-2">Chart a New Course</h4>
                <p className="font-body text-on-surface-variant max-w-sm mx-auto">
                  Type a voyage name in the form on the left and click "Establish Charter" to get started.
                </p>
              </div>
            ) : (
              groups.map((group, index) => (
                <div key={group.id} className="bg-surface border-2 border-outline-variant/40 rounded-xl overflow-hidden flex flex-col hover:shadow-md hover:border-secondary/50 transition-all group relative">
                  <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                    <BottomSheetTooltip text="Delete charter">
                      <button
                        onClick={() => handleDelete(group.id)}
                        className="text-error p-2 hover:bg-error/10 rounded-full"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </BottomSheetTooltip>
                  </div>

                  <div className="bg-surface-container-highest p-4 border-b border-dashed border-outline-variant">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-secondary text-sm">directions_boat</span>
                      <span className="font-mono text-xs text-secondary uppercase tracking-widest font-bold">
                        Voyage {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <h4 className="font-display text-xl font-bold text-primary-container group-hover:text-secondary transition-colors pr-8">
                      {group.group_name}
                    </h4>
                    <p className="font-body text-sm text-on-surface-variant mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">calendar_today</span>
                      Est. {new Date(group.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="p-5 flex-1 flex flex-col gap-4">
                    <div className="bg-surface-container-low border border-outline-variant/30 rounded p-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-on-surface-variant">Total Ledger</span>
                        <span className="font-bold text-primary-container">
                          ₹{(groupTotals[group.id] ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 mt-auto">
                      <span className="text-sm text-on-surface-variant">Your Balance:</span>
                      {group.status !== 'finished' ? (
                        <span className="font-bold text-yellow-200 px-2 py-1 bg-yellow-900/30 rounded text-sm flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">sailing</span> Currently in journey
                        </span>
                      ) : (
                        <span className="font-bold text-red-600 px-2 py-1 bg-red-900/20 rounded text-sm flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">warning</span> Not Settled
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-surface-container p-3 border-t-2 border-dashed border-outline-variant flex justify-center">
                    <Link href={`/dashboard/groups/${group.id}`} className="text-primary hover:text-secondary font-mono text-xs uppercase flex items-center gap-1 transition-colors font-bold tracking-wider">
                      View Ledger <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
    </div>
  );
}
