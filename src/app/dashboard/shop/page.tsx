'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

const SHOP_ITEMS = [
  { avatar: '🏴‍☠️', name: 'Jolly Roger', price: 0 },
  { avatar: '🦜', name: 'First Mate Polly', price: 100 },
  { avatar: '⚓', name: 'Rusty Anchor', price: 200 },
  { avatar: '🧜‍♀️', name: 'Siren of the Sea', price: 300 },
  { avatar: '⚔️', name: 'Crossed Swords', price: 400 },
  { avatar: '🦑', name: 'The Kraken', price: 500 },
  { avatar: '🗺️', name: 'Treasure Map', price: 600 },
  { avatar: '🦈', name: 'Great White', price: 800 },
  { avatar: '🦀', name: 'Pinchy', price: 1000 },
  { avatar: '🏝️', name: 'Desert Island', price: 1200 },
  { avatar: '🪙', name: 'Cursed Coin', price: 1500 },
  { avatar: '🚢', name: 'The Galleon', price: 2000 },
  { avatar: '🔭', name: 'Spyglass', price: 2500 },
  { avatar: '💣', name: 'Powder Keg', price: 3500 },
  { avatar: '👑', name: 'Pirate King', price: 5000 }
];

export default function ShipwrightsShopPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [doubloons, setDoubloons] = useState(0);
  const [unlockedAvatars, setUnlockedAvatars] = useState<string[]>(['🏴‍☠️']);
  const [activeAvatar, setActiveAvatar] = useState('🏴‍☠️');
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);

      const { data } = await supabase
        .from('users')
        .select('doubloons, unlocked_avatars, active_avatar')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setDoubloons(data.doubloons || 0);
        setUnlockedAvatars(data.unlocked_avatars || ['🏴‍☠️']);
        setActiveAvatar(data.active_avatar || '🏴‍☠️');
      }
      setLoading(false);
    };

    fetchProfile();
  }, []);

  const handleEquip = async (avatar: string) => {
    if (!userId) return;
    setActiveAvatar(avatar);

    await supabase.from('users').update({ active_avatar: avatar }).eq('id', userId);
  };

  const handleBuy = async (avatar: string, price: number) => {
    if (!userId || purchasing) return;
    if (doubloons < price) {
      alert("Not enough Doubloons, ye scallywag! Settle more debts to earn 'em.");
      return;
    }

    setPurchasing(true);
    const newDoubloons = doubloons - price;
    const newUnlocked = [...unlockedAvatars, avatar];

    setDoubloons(newDoubloons);
    setUnlockedAvatars(newUnlocked);
    setActiveAvatar(avatar);

    await supabase.from('users').update({
      doubloons: newDoubloons,
      unlocked_avatars: newUnlocked,
      active_avatar: avatar
    }).eq('id', userId);

    setPurchasing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-5xl text-secondary animate-spin">sailing</span>
          <p className="font-mono text-sm text-on-surface-variant uppercase tracking-widest">Opening Shop...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[80vh]">
      {/* Background with watermark hidden via CSS transform */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20 rounded-3xl -m-4 md:-m-8">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/image_7.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: 'scale(1.15) translateY(6%)',
            filter: 'brightness(1.5)'
          }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"></div>
      </div>

      <div className="relative z-10">
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-outline-variant text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-all shadow-sm group"
          >
            <span className="material-symbols-outlined text-[16px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
            Back to Home
          </Link>
        </div>
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-secondary uppercase tracking-widest mb-2 flex items-center gap-2 font-bold">
              <span className="material-symbols-outlined text-sm">storefront</span>
              The Shipwright's Shop
            </p>
            <h2 className="font-display text-4xl font-bold text-primary tracking-tight">Upgrade Your Legend</h2>
            <p className="text-on-surface-variant mt-2 max-w-xl">
              Spend your hard-earned Doubloons on new avatars! You earn 50 Doubloons every time you settle a debt.
            </p>
          </div>
          <div className="bg-surface-container-high border-2 border-secondary/50 rounded-xl px-6 py-4 flex flex-col items-center shadow-[0_0_20px_rgba(255,215,0,0.1)]">
            <p className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-1">Your Stash</p>
            <div className="flex items-center gap-2 text-secondary font-display font-bold text-3xl">
              🪙 {doubloons} <span className="text-lg">Doubloons</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {SHOP_ITEMS.map((item) => {
            const isUnlocked = unlockedAvatars.includes(item.avatar);
            const isActive = activeAvatar === item.avatar;
            const canAfford = doubloons >= item.price;

            return (
              <div
                key={item.avatar}
                className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-300 flex flex-col items-center p-6 text-center
                ${isActive ? 'bg-secondary/10 border-secondary scale-105 shadow-[0_0_20px_rgba(255,215,0,0.2)] z-10'
                    : isUnlocked ? 'bg-surface border-outline-variant hover:border-secondary hover:bg-surface-container-high'
                      : 'bg-surface-container border-outline-variant/50 opacity-80'}`}
              >
                <div className="text-6xl mb-4 transform transition-transform hover:scale-110">{item.avatar}</div>
                <h3 className="font-bold text-on-surface mb-1">{item.name}</h3>

                {!isUnlocked && (
                  <p className={`font-mono text-sm font-bold flex items-center gap-1 ${canAfford ? 'text-secondary' : 'text-error/80'}`}>
                    🪙 {item.price}
                  </p>
                )}

                <div className="mt-4 w-full">
                  {isActive ? (
                    <button disabled className="w-full py-2 bg-secondary text-white font-bold text-xs uppercase tracking-widest rounded-lg flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span> Equipped
                    </button>
                  ) : isUnlocked ? (
                    <button
                      onClick={() => handleEquip(item.avatar)}
                      className="w-full py-2 bg-surface text-on-surface border border-outline-variant hover:bg-surface-container-high hover:border-secondary transition-colors font-bold text-xs uppercase tracking-widest rounded-lg flex items-center justify-center gap-1"
                    >
                      Equip
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBuy(item.avatar, item.price)}
                      disabled={!canAfford || purchasing}
                      className={`w-full py-2 font-bold text-xs uppercase tracking-widest rounded-lg flex items-center justify-center gap-1 transition-colors
                      ${canAfford ? 'bg-primary text-white hover:bg-primary/90' : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'}`}
                    >
                      {canAfford ? 'Buy & Equip' : 'Too Poor'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
