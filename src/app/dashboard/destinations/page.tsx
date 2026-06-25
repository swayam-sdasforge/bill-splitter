'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamically import the MapComponent with SSR disabled
const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[60vh] flex flex-col items-center justify-center bg-surface-container-low rounded-xl border-4 border-outline-variant/30 animate-pulse">
      <span className="material-symbols-outlined text-5xl text-secondary animate-bounce">explore</span>
      <p className="font-mono text-sm text-on-surface-variant uppercase tracking-widest mt-4">Unrolling the Map...</p>
    </div>
  )
});

type ExpenseWithLocation = {
  id: string;
  amount: number;
  description: string;
  lat: number;
  lng: number;
  location_name?: string;
  group_name?: string;
};

export default function DestinationsPage() {
  const [expenses, setExpenses] = useState<ExpenseWithLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLocations = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      // Fetch user's voyages
      const { data: groupData } = await supabase
        .from('shared_groups')
        .select('id, group_name');
        
      if (!groupData || groupData.length === 0) {
        setLoading(false);
        return;
      }
      
      const groupMap: Record<string, string> = {};
      groupData.forEach(g => { groupMap[g.id] = g.group_name; });
      const groupIds = groupData.map(g => g.id);

      // Fetch expenses with coordinates
      const { data: expData } = await supabase
        .from('group_expenses')
        .select('id, amount, description, lat, lng, location_name, group_id')
        .in('group_id', groupIds)
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (expData) {
        setExpenses(expData.map(e => ({
          ...e,
          group_name: groupMap[e.group_id]
        })));
      }
      
      setLoading(false);
    };

    fetchLocations();
  }, []);

  return (
    <div className="max-w-6xl mx-auto w-full p-4 md:p-8 h-full flex flex-col min-h-screen relative z-10">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 w-full h-full object-cover z-[-1] opacity-60"
      >
        <source src="/boat_background.mp4" type="video/mp4" />
      </video>
      {/* Header */}
      <div className="py-8 border-b border-outline-variant/30 mb-8 flex-shrink-0 flex flex-col gap-4">
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
            World Chart
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-primary-container tracking-tight">Ports of Call</h2>
          <p className="font-body-md text-on-surface-variant mt-2 max-w-2xl">
            A visual log of every tavern, dock, and marketplace where your crew has dropped coin. Track your financial footprint across the seven seas.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-[60vh] relative mb-8">
        {loading ? (
          <div className="w-full h-full min-h-[60vh] flex flex-col items-center justify-center bg-surface-container-low rounded-xl border-4 border-outline-variant/30">
            <span className="material-symbols-outlined text-5xl text-secondary animate-pulse">sync</span>
            <p className="font-mono text-sm text-on-surface-variant uppercase tracking-widest mt-4">Consulting the Navigators...</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="w-full h-full min-h-[60vh] flex flex-col items-center justify-center bg-surface-container-low rounded-xl border-4 border-dashed border-outline-variant p-8 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4">location_off</span>
            <h3 className="font-display text-2xl font-bold text-primary mb-2">Uncharted Waters</h3>
            <p className="text-on-surface-variant max-w-md">
              Your map is blank! Next time you log an expense in your Voyage Ledger, make sure to check "Drop an Anchor" to log your GPS coordinates.
            </p>
          </div>
        ) : (
          <MapComponent expenses={expenses} />
        )}
      </div>
    </div>
  );
}
