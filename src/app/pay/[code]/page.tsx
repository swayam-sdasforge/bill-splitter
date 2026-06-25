'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

export default function SmugglersLinkPage({ params }: { params: { code: string } }) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [guest, setGuest] = useState<{ id: string, name: string } | null>(null);
  const [group, setGroup] = useState<{ id: string, name: string } | null>(null);
  const [creator, setCreator] = useState<{ id: string, name: string, upiId: string | null, qrCodeUrl: string | null } | null>(null);
  
  const [debt, setDebt] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch guest
        const { data: guestData, error: guestError } = await supabase
          .from('voyage_guests')
          .select('*')
          .eq('claim_code', params.code.toUpperCase())
          .maybeSingle();
          
        if (guestError || !guestData) {
          setErrorMsg("Invalid Smuggler's Link! This parchment has faded into myth.");
          return;
        }
        
        setGuest({ id: guestData.id, name: guestData.guest_name });
        
        // 2. Fetch group
        const { data: groupData } = await supabase
          .from('shared_groups')
          .select('id, group_name')
          .eq('id', guestData.group_id)
          .single();
          
        if (groupData) setGroup({ id: groupData.id, name: groupData.group_name });
        
        // 3. Fetch creator
        const { data: creatorData } = await supabase
          .from('users')
          .select('id, name, upi_id, qr_code_url')
          .eq('id', guestData.created_by)
          .single();
          
        if (creatorData) setCreator({ id: creatorData.id, name: creatorData.name || 'Captain', upiId: creatorData.upi_id, qrCodeUrl: creatorData.qr_code_url });

        // 4. Calculate Debt
        // Fetch expenses, splits, payments, and all participants count
        const { data: allGuests } = await supabase.from('voyage_guests').select('id').eq('group_id', guestData.group_id);
        const { data: allMembers } = await supabase.from('group_members').select('user_id').eq('group_id', guestData.group_id);
        const allParticipantsCount = (allGuests?.length || 0) + (allMembers?.length || 0);

        const { data: expenses } = await supabase.from('group_expenses').select('*').eq('group_id', guestData.group_id).eq('is_disputed', false);
        const expenseIds = expenses ? expenses.map((e: any) => e.id) : [];
        const { data: splits } = await supabase.from('expense_splits').select('*').in('expense_id', expenseIds);
        const { data: payments } = await supabase.from('payments').select('*').eq('group_id', guestData.group_id);

        let balance = 0;
        
        if (expenses) {
          expenses.forEach((exp: any) => {
            if (exp.paid_by_guest === guestData.id) balance += Number(exp.amount);
            
            if (exp.split_type && exp.split_type !== 'equal') {
              const expSplits = splits?.filter((s: any) => s.expense_id === exp.id) || [];
              expSplits.forEach((s: any) => {
                if (s.guest_id === guestData.id) balance -= Number(s.amount);
              });
            } else {
              balance -= Number(exp.amount) / allParticipantsCount;
            }
          });
        }
        
        if (payments) {
          payments.forEach((p: any) => {
            if (p.payer_guest_id === guestData.id) balance += Number(p.amount);
            if (p.payee_guest_id === guestData.id) balance -= Number(p.amount);
          });
        }

        setDebt(balance);
        
      } catch (err) {
        setErrorMsg("Failed to decode the map.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [params.code]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="material-symbols-outlined text-secondary animate-spin text-5xl">sailing</span>
      </div>
    );
  }

  if (errorMsg || !guest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-error/10 border border-error/30 p-8 rounded-xl max-w-md text-center">
          <span className="material-symbols-outlined text-error text-6xl mb-4">skull</span>
          <h1 className="text-2xl font-display font-bold text-error mb-2">Dead End</h1>
          <p className="text-on-surface-variant font-body">{errorMsg}</p>
        </div>
      </div>
    );
  }

  const amountOwed = Math.abs(Math.min(0, debt));
  const isSettled = amountOwed < 0.01;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
      <div className="fixed inset-0 z-0 opacity-10 pointer-events-none" style={{ backgroundImage: "url('/image_6.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
      
      <div className="bg-surface-container border-2 border-double border-outline-variant/50 rounded-2xl p-8 w-full max-w-md shadow-2xl relative z-10 text-center">
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center border-2 border-secondary">
            <span className="material-symbols-outlined text-secondary text-4xl">{isSettled ? 'done_all' : 'receipt_long'}</span>
          </div>
        </div>
        
        <p className="font-mono text-xs uppercase tracking-widest text-on-surface-variant mb-2">Captain's Demand</p>
        <h1 className="font-display text-3xl font-bold text-primary mb-1">Ahoy, {guest.name}!</h1>
        <p className="text-sm text-on-surface-variant mb-8">
          From the voyage <strong className="text-secondary">{group?.name}</strong>
        </p>
        
        {isSettled ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-green-500 mb-2">Debt Settled!</h2>
            <p className="text-on-surface-variant text-sm">Ye have paid your dues to {creator?.name}. The ledger is clean!</p>
          </div>
        ) : (
          <div className="mb-8">
            <p className="text-sm text-on-surface-variant mb-1">You owe {creator?.name}</p>
            <h2 className="font-display text-5xl font-bold text-error mb-6">
              ₹{amountOwed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </h2>
            
            {creator?.qrCodeUrl ? (
              <div className="flex flex-col items-center gap-3">
                <div className="bg-white p-3 rounded-xl border-4 border-double border-secondary/50 w-56 h-56 flex items-center justify-center">
                  <img src={creator.qrCodeUrl} alt="UPI QR" className="w-full h-full object-contain" />
                </div>
                <p className="font-mono text-xs uppercase tracking-widest text-secondary font-bold">Scan to Pay</p>
              </div>
            ) : creator?.upiId ? (
              <div className="flex flex-col items-center gap-3">
                <div className="bg-white p-3 rounded-xl border-4 border-double border-secondary/50 w-56 h-56 flex items-center justify-center">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=${encodeURIComponent(creator.upiId)}&pn=${encodeURIComponent(creator.name)}&am=${amountOwed}&cu=INR`} alt="UPI QR" className="w-full h-full" />
                </div>
                <p className="font-mono text-xs uppercase tracking-widest text-secondary font-bold">Scan to Pay</p>
                <code className="text-xs bg-surface-container-high px-2 py-1 rounded text-on-surface-variant">{creator.upiId}</code>
              </div>
            ) : (
              <div className="bg-surface-container-high p-4 rounded-lg border border-outline-variant">
                <span className="material-symbols-outlined text-error mb-2">money_off</span>
                <p className="text-sm font-bold text-on-surface">{creator?.name} hasn't added UPI details.</p>
                <p className="text-xs text-on-surface-variant mt-1">Settle via cash or ask them for their details.</p>
              </div>
            )}
          </div>
        )}
        
        <p className="text-xs text-on-surface-variant mt-8 opacity-60">
          Powered by <strong className="text-primary opacity-100">Bill Splitter</strong>
        </p>
      </div>
    </div>
  );
}
