'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Member = {
  id: string;
  name: string;
};

export default function KrakenWheelPage() {
  const params = useParams();
  const groupId = params.id as string;
  const [members, setMembers] = useState<Member[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const fetchMembers = async () => {
      // Fetch registered members
      const { data: membersData, error: membersError } = await supabase
        .from('group_members')
        .select('user_id, users(name, email)')
        .eq('group_id', groupId);

      // Fetch guests
      const { data: guestsData, error: guestsError } = await supabase
        .from('voyage_guests')
        .select('id, guest_name')
        .eq('group_id', groupId);

      let allParticipants: Member[] = [];

      if (!membersError && membersData) {
        allParticipants = membersData.map((m: any) => ({
          id: m.user_id,
          name: m.users?.name || m.users?.email?.split('@')[0] || 'Unknown Pirate'
        }));
      }

      if (!guestsError && guestsData) {
        const parsedGuests = guestsData.map((g: any) => ({
          id: g.id,
          name: g.guest_name
        }));
        allParticipants = [...allParticipants, ...parsedGuests];
      }

      setMembers(allParticipants);
    };

    if (groupId) {
      fetchMembers();
    }
  }, [groupId]);

  const spinWheel = () => {
    if (members.length === 0) return;

    setIsSpinning(true);
    setSelectedMember(null);

    // Spin for 3-5 seconds
    const spinDuration = 3000 + Math.random() * 2000;
    // Rotate multiple times (10 to 20 full rotations) + a random extra angle
    const extraDegrees = Math.floor(Math.random() * 360);
    const newRotation = rotation + (360 * 10) + extraDegrees;

    setRotation(newRotation);

    // Calculate who won based on the final angle
    // The pointer is at the top (0 degrees).
    // The wheel is divided into members.length slices.
    // CSS rotation goes clockwise. So the slice at the top is (360 - (newRotation % 360)).
    setTimeout(() => {
      const sliceAngle = 360 / members.length;
      const normalizedRotation = newRotation % 360;
      // Invert the rotation because the wheel moves clockwise under a fixed pointer
      const pointerAngle = (360 - normalizedRotation) % 360;
      const winnerIndex = Math.floor(pointerAngle / sliceAngle);

      setSelectedMember(members[winnerIndex]);
      setIsSpinning(false);
    }, spinDuration);
  };

  return (
    <div className="max-w-4xl mx-auto w-full p-4 md:p-8 min-h-screen relative flex flex-col items-center justify-center overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-error/20 via-background to-background -z-10 pointer-events-none"></div>

      <Link
        href={`/dashboard/groups/${groupId}`}
        className="absolute top-4 left-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-outline-variant text-sm font-bold text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-all shadow-md group"
      >
        <span className="material-symbols-outlined text-[16px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
        Flee to Voyage
      </Link>

      <div className="text-center mb-10 mt-8 relative z-10">
        <div className="inline-block relative">
          <h1 className="font-display text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500 tracking-tight drop-shadow-[0_4px_12px_rgba(220,38,38,0.4)] animate-pulse mb-4">
            The Kraken's Wheel
          </h1>
          {/* Decorative tentacles */}
          <span className="absolute -left-12 -top-6 text-4xl opacity-80 transform -scale-x-100 rotate-45">🦑</span>
          <span className="absolute -right-12 -top-6 text-4xl opacity-80 rotate-45">🦑</span>
        </div>
        <p className="font-body-lg text-on-surface-variant max-w-lg mx-auto bg-surface-container/50 p-4 rounded-xl backdrop-blur-sm border border-outline-variant/30">
          Gather 'round ye scurvy dogs! Spin the cursed wheel to decide who pays the toll or walks the plank!
        </p>
      </div>

      {members.length > 0 ? (
        <div className="relative w-80 h-80 md:w-96 md:h-96 my-8">
          {/* Glowing Aura Behind Wheel */}
          <div className={`absolute inset-0 rounded-full blur-2xl transition-all duration-1000 ${isSpinning ? 'bg-error opacity-80 animate-pulse scale-110' : 'bg-primary/40 opacity-40 scale-100'}`}></div>

          {/* Pointer */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
            <div className={`w-12 h-16 bg-gradient-to-b from-gray-200 to-gray-500 rounded-t-full relative z-20 ${isSpinning ? 'animate-bounce' : ''}`}>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[24px] border-l-transparent border-r-[24px] border-r-transparent border-t-[32px] border-t-gray-500 translate-y-full"></div>
            </div>
            {/* Skull motif on pointer */}
            <span className="absolute top-2 text-2xl z-30 font-bold">💀</span>
          </div>

          {/* The Wheel */}
          <div
            className="w-full h-full rounded-full border-[12px] border-surface-container-highest shadow-[inset_0_0_20px_rgba(0,0,0,0.8),_0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden relative transition-transform z-10"
            style={{
              transform: `rotate(${rotation}deg)`,
              transitionDuration: isSpinning ? '4s' : '0s',
              transitionTimingFunction: 'cubic-bezier(0.15, 0.85, 0.15, 1)', // Smooth deceleration
              background: `conic-gradient(${members.map((m, i) => {
                const colors = ['#b91c1c', '#ea580c', '#ca8a04', '#15803d', '#0369a1', '#6d28d9', '#be185d'];
                const sliceAngle = 360 / members.length;
                return `${colors[i % colors.length]} ${i * sliceAngle}deg ${(i + 1) * sliceAngle}deg`;
              }).join(', ')})`
            }}
          >
            {/* Text Labels inside Wheel */}
            {members.map((member, index) => {
              const sliceAngle = 360 / members.length;
              const rotateAngle = (index * sliceAngle) + (sliceAngle / 2);

              return (
                <div
                  key={member.id}
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-1/2 origin-bottom flex flex-col items-center justify-start pt-6 z-20"
                  style={{ transform: `rotate(${rotateAngle}deg)` }}
                >
                  <span
                    className="font-display font-extrabold text-white text-lg tracking-widest uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
                    style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                  >
                    {member.name.substring(0, 12)}
                  </span>
                </div>
              );
            })}

            {/* Inner Wheel Texture Overlay */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-20 mix-blend-multiply pointer-events-none rounded-full"></div>

            {/* Center Hub */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-[radial-gradient(circle,_#4b5563_0%,_#1f2937_100%)] rounded-full border-4 border-gray-400 z-30 flex items-center justify-center shadow-[0_4px_10px_rgba(0,0,0,0.5),_inset_0_2px_4px_rgba(255,255,255,0.3)]">
              <span className="material-symbols-outlined text-4xl text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]">change_history</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-pulse flex flex-col items-center text-on-surface-variant my-24 bg-surface-container p-8 rounded-full">
          <span className="material-symbols-outlined text-5xl mb-4 animate-spin text-amber-500">autorenew</span>
          <p className="font-mono text-lg uppercase">Mustering the crew...</p>
        </div>
      )}

      <div className="mt-8 text-center h-32 flex flex-col justify-center">
        {selectedMember ? (
          <div className="animate-in zoom-in slide-in-from-bottom-4 duration-500 bounce bg-error/10 border-2 border-error p-6 rounded-2xl shadow-[0_0_30px_rgba(220,38,38,0.3)] backdrop-blur-md">
            <p className="text-on-surface-variant uppercase tracking-widest text-sm font-bold mb-1">The Kraken demands:</p>
            <h2 className="font-display text-4xl md:text-5xl text-error font-extrabold drop-shadow-md">
              {selectedMember.name}!
            </h2>
            <p className="text-on-surface mt-2 italic font-serif">"Yer paying for the next round, matey!"</p>
          </div>
        ) : (
          <p className="text-on-surface-variant/50 font-mono text-lg animate-pulse">
            {isSpinning ? 'Hold on to yer hats...' : 'The Kraken slumbers...'}
          </p>
        )}
      </div>

      <button
        onClick={spinWheel}
        disabled={isSpinning || members.length === 0}
        className={`mt-6 font-display font-extrabold uppercase tracking-[0.2em] px-16 py-5 rounded-2xl shadow-[0_10px_0_#991b1b,0_15px_20px_rgba(0,0,0,0.4)] transition-all transform flex items-center gap-3 text-xl
          ${isSpinning
            ? 'bg-gray-600 text-gray-400 translate-y-2 shadow-[0_2px_0_#4b5563] cursor-not-allowed'
            : 'bg-gradient-to-b from-error to-red-700 text-white hover:from-red-500 hover:to-error active:translate-y-2 active:shadow-[0_2px_0_#991b1b] animate-[pulse_2s_infinite]'
          }
        `}
      >
        <span className={`material-symbols-outlined text-3xl ${isSpinning ? 'animate-spin' : ''}`}>
          {isSpinning ? 'cyclone' : 'sailing'}
        </span>
        {isSpinning ? 'Spinning...' : 'Unleash the Kraken!'}
      </button>
    </div>
  );
}
