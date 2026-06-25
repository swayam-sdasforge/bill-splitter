'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';

type Expense = {
  id: string;
  amount: number;
  category: string;
  paid_by: string | null;
  paid_by_guest?: string | null;
};

const COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6', '#14B8A6'];

export default function TreasureMapPage() {
  const params = useParams();
  const groupId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState('Voyage');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      const { data: groupData } = await supabase.from('shared_groups').select('group_name').eq('id', groupId).maybeSingle();
      if (groupData) setGroupName(groupData.group_name);

      const { data: expenseData } = await supabase.from('group_expenses').select('*').eq('group_id', groupId).eq('is_disputed', false);
      
      const { data: membersData } = await supabase.from('group_members').select('user_id, users(name)').eq('group_id', groupId);
      const { data: guestsData } = await supabase.from('voyage_guests').select('id, guest_name').eq('group_id', groupId);

      const memberMap: Record<string, string> = {};
      if (membersData) membersData.forEach((m: any) => memberMap[m.user_id] = m.users?.name || 'Pirate');
      if (guestsData) guestsData.forEach((g: any) => memberMap[g.id] = g.guest_name);
      
      setMembers(memberMap);
      if (expenseData) setExpenses(expenseData);
      
      setLoading(false);
    };
    fetchData();
  }, [groupId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-5xl text-secondary animate-spin">explore</span>
          <p className="font-mono text-sm text-on-surface-variant uppercase tracking-widest">Unfurling the Map...</p>
        </div>
      </div>
    );
  }

  // Calculate Data for Pie Chart (Category Breakdown)
  const categoryTotals: Record<string, number> = {
    food: 0,
    drinks: 0,
    activities: 0,
    shopping: 0,
    other: 0
  };
  
  expenses.forEach(e => {
    const cat = e.category && categoryTotals[e.category] !== undefined ? e.category : 'other';
    categoryTotals[cat] += Number(e.amount);
  });
  
  const pieData = Object.keys(categoryTotals).map(cat => ({
    name: cat.toUpperCase(),
    value: categoryTotals[cat]
  })).sort((a, b) => b.value - a.value);

  // Calculate Data for Bar Chart (Top Spenders)
  const spenderTotals: Record<string, number> = {};
  expenses.forEach(e => {
    const pId = e.paid_by || e.paid_by_guest;
    if (pId) {
      spenderTotals[pId] = (spenderTotals[pId] || 0) + Number(e.amount);
    }
  });

  const barData = Object.keys(spenderTotals).map(pId => ({
    name: members[pId] || 'Pirate',
    amount: spenderTotals[pId]
  })).sort((a, b) => b.amount - a.amount);

  return (
    <div className="max-w-5xl mx-auto w-full pb-16 pt-8 px-4 md:px-0">
      {/* Header */}
      <div className="py-8 border-b border-outline-variant/30 mb-8">
        <Link
          href={`/dashboard/groups/${groupId}`}
          className="self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-outline-variant text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-all shadow-sm group mb-4"
        >
          <span className="material-symbols-outlined text-[16px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
          Back to Ledger
        </Link>
        <p className="font-mono text-xs text-secondary uppercase tracking-widest mb-2 flex items-center gap-2 font-bold">
          <span className="material-symbols-outlined text-sm">map</span>
          Treasure Map
        </p>
        <h2 className="font-display text-4xl md:text-5xl font-bold text-primary-container tracking-tight">
          {groupName} Analytics
        </h2>
        <p className="text-on-surface-variant mt-2 max-w-2xl">
          Where did the plunder go? Review the charts below to see a visual breakdown of your crew's spending habits.
        </p>
      </div>

      {expenses.length === 0 ? (
        <div className="bg-surface-container border-2 border-dashed border-outline-variant rounded-xl p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-outline mb-4">search_off</span>
          <h4 className="font-display text-xl font-bold text-on-surface mb-2">No Treasure Found</h4>
          <p className="text-on-surface-variant">Log some expenses in the ledger first to generate the map.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Pie Chart */}
          <div className="bg-surface-container-low border-2 border-double border-outline-variant rounded-xl p-6 shadow-[0_4px_15px_-5px_rgba(0,0,0,0.3)]">
            <h3 className="font-display text-2xl font-bold text-primary mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">pie_chart</span>
              Booty Breakdown (Category)
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                    contentStyle={{ backgroundColor: '#1A1820', border: '1px solid #4B3A5A', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#FCD34D', fontWeight: 'bold' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="bg-surface-container-low border-2 border-double border-outline-variant rounded-xl p-6 shadow-[0_4px_15px_-5px_rgba(0,0,0,0.3)]">
            <h3 className="font-display text-2xl font-bold text-primary mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">bar_chart</span>
              Top Spenders (Crew)
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis type="number" tickFormatter={(val) => `₹${val}`} stroke="#A78BFA" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="#A78BFA" fontSize={12} width={80} />
                  <Tooltip 
                    cursor={{fill: '#2D2A38'}}
                    formatter={(value: any) => `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                    contentStyle={{ backgroundColor: '#1A1820', border: '1px solid #4B3A5A', borderRadius: '8px', color: '#fff' }}
                  />
                  <Bar dataKey="amount" fill="#F59E0B" radius={[0, 4, 4, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
