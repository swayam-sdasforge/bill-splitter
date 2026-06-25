'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BottomSheetTooltip from '@/components/ui/BottomSheetTooltip';
import { supabase } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { text: 'Weak', class1: 'bg-[#F5C3C3]', class2: 'bg-[#F2EFE9]/10', class3: 'bg-[#F2EFE9]/10', textClass: 'text-[#F5C3C3]' };
    if (pass.length < 5) return { text: 'Weak', class1: 'bg-[#F5C3C3]', class2: 'bg-[#F2EFE9]/10', class3: 'bg-[#F2EFE9]/10', textClass: 'text-[#F5C3C3]' };
    if (pass.length < 9) return { text: 'Fair', class1: 'bg-[#E5E1C8]', class2: 'bg-[#E5E1C8]', class3: 'bg-[#F2EFE9]/10', textClass: 'text-[#E5E1C8]' };
    return { text: 'Strong', class1: 'bg-[#B5D6D6]', class2: 'bg-[#B5D6D6]', class3: 'bg-[#B5D6D6]', textClass: 'text-[#B5D6D6]' };
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.name }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: insertError } = await supabase.from('users').insert({
          id: authData.user.id,
          email: formData.email,
          name: formData.name
        });
        if (insertError) console.error("User insert error:", insertError);
      }

      setMessage({ type: 'success', text: 'Account created successfully! Redirecting...' });
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);

    } catch (err: any) {
      if (err.message.includes('already registered')) {
        setMessage({ type: 'error', text: 'An account with this email already exists' });
      } else {
        setMessage({ type: 'error', text: err.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const strength = getPasswordStrength(formData.password);

  return (
    <div className="bg-background min-h-screen flex items-center justify-center p-4 md:p-6 relative overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-90"
        style={{ backgroundImage: "url('/signup_castle_bg.jpg')" }}
      ></div>

      {/* Main Registration Card */}
      <main className="relative z-10 w-full max-w-[480px] bg-[#2C271B]/10 text-[#F2EFE9] shadow-2xl backdrop-blur-sm p-8 md:p-12 min-h-screen md:min-h-0 flex flex-col justify-center">

        {/* Header Section */}
        <header className="text-center mb-10 relative">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1E1A11] mb-6 relative">
            <span className="material-symbols-outlined text-[#F2EFE9] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>sailing</span>
            {/* Small decorative stamps */}
            <div className="absolute -right-1.5 -bottom-1.5 w-[18px] h-[18px] bg-[#4A2626] rounded-full border border-[#2C271B] flex items-center justify-center">
              <span className="material-symbols-outlined text-[10px] text-[#E08585]">anchor</span>
            </div>
          </div>
          <h1 className="font-display text-4xl text-[#F2EFE9] mb-2 font-bold tracking-tight">Join the Voyage</h1>
          <p className="font-body text-sm text-[#F2EFE9]/80 italic relative inline-block mb-4">
            Secure your stateroom and split the tab.
          </p>
          <div className="flex justify-center">
            <svg width="60" height="8" viewBox="0 0 60 8" fill="none" xmlns="http://www.w3.org/2000/svg" suppressHydrationWarning>
              <path d="M0 4 Q 7.5 0, 15 4 T 30 4 T 45 4 T 60 4" stroke="#F2EFE9" strokeOpacity="0.15" strokeWidth="1" fill="none" suppressHydrationWarning />
            </svg>
          </div>
        </header>

        {message.text && (
          <div className={`p-4 mb-6 relative z-20 rounded text-sm text-center ${message.type === 'error' ? 'bg-[#F5C3C3] text-[#A63A3A] border border-[#A63A3A]/20' : 'bg-[#B5D6D6] text-[#2C6E63] border border-[#2C6E63]/20'}`}>
            {message.text}
          </div>
        )}

        {/* Signup Form */}
        <form onSubmit={handleSignup} className="space-y-8 relative z-20">
          {/* Name Input */}
          <div className="relative group">
            <label className="font-mono text-[10px] uppercase tracking-widest text-[#F2EFE9]/70 block mb-2 font-bold" htmlFor="fullName">Passenger Name</label>
            <div className="relative">
              <input
                id="fullName"
                type="text"
                placeholder="e.g. Captain Haddock"
                className="w-full bg-transparent border-0 border-b border-[#F2EFE9]/20 focus:border-[#F2EFE9] focus:ring-0 py-2 pl-0 pr-8 font-body text-[15px] text-[#F2EFE9] placeholder:italic placeholder:text-[#F2EFE9]/40 transition-colors focus:outline-none"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <span className="material-symbols-outlined absolute right-0 bottom-2 text-[#F2EFE9]/40 group-focus-within:text-[#F2EFE9] transition-colors text-[20px]">person</span>
            </div>
          </div>

          {/* Email Input */}
          <div className="relative group">
            <label className="font-mono text-[10px] uppercase tracking-widest text-[#F2EFE9]/70 block mb-2 font-bold" htmlFor="email">Telegraph Address (Email)</label>
            <div className="relative">
              <input
                id="email"
                type="email"
                placeholder="captain@maritima.com"
                className="w-full bg-transparent border-0 border-b border-[#F2EFE9]/20 focus:border-[#F2EFE9] focus:ring-0 py-2 pl-0 pr-8 font-body text-[15px] text-[#F2EFE9] placeholder:italic placeholder:text-[#F2EFE9]/40 transition-colors focus:outline-none"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
              <span className="material-symbols-outlined absolute right-0 bottom-2 text-[#F2EFE9]/40 group-focus-within:text-[#F2EFE9] transition-colors text-[20px]">mail</span>
            </div>
          </div>

          {/* Password Input */}
          <div className="relative group">
            <label className="font-mono text-[10px] uppercase tracking-widest text-[#F2EFE9]/70 block mb-2 font-bold" htmlFor="password">Secret Code</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="w-full bg-transparent border-0 border-b border-[#F2EFE9]/20 focus:border-[#F2EFE9] focus:ring-0 py-2 pl-0 pr-8 font-body text-lg text-[#F2EFE9] placeholder:text-[#F2EFE9]/30 transition-colors tracking-widest focus:outline-none"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={8}
              />
              <span
                className="material-symbols-outlined absolute right-0 bottom-2 text-[#F2EFE9]/40 group-focus-within:text-[#F2EFE9] transition-colors cursor-pointer text-[20px]"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'visibility' : 'visibility_off'}
              </span>
            </div>

            {/* Password Strength Indicator */}
            {formData.password && (
              <div className="mt-2">
                <div className="flex gap-1 h-1 w-full">
                  <div className={`h-full flex-1 rounded-full transition-colors ${strength.class1}`}></div>
                  <div className={`h-full flex-1 rounded-full transition-colors ${strength.class2}`}></div>
                  <div className={`h-full flex-1 rounded-full transition-colors ${strength.class3}`}></div>
                </div>
                <p className={`font-mono text-[8px] mt-1 text-right uppercase tracking-wider ${strength.textClass}`}>
                  Strength: <span className="font-bold">{strength.text}</span>
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password Input */}
          <div className="relative group">
            <label className="font-mono text-[10px] uppercase tracking-widest text-[#F2EFE9]/70 block mb-2 font-bold" htmlFor="confirmPassword">Confirm Secret Code</label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="w-full bg-transparent border-0 border-b border-[#F2EFE9]/20 focus:border-[#F2EFE9] focus:ring-0 py-2 pl-0 pr-8 font-body text-lg text-[#F2EFE9] placeholder:text-[#F2EFE9]/30 transition-colors tracking-widest focus:outline-none"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
              />
              <span className="material-symbols-outlined absolute right-0 bottom-2 text-[#F2EFE9]/40 group-focus-within:text-[#F2EFE9] transition-colors text-[20px]">lock</span>
            </div>
          </div>

          {/* Submit Button (Ticket Style) */}
          <div className="pt-8 pb-2">
            <button
              type="submit"
              disabled={loading}
              className="relative w-full bg-[#080E1C] text-[#F2EFE9] py-4 px-6 flex justify-between items-center group overflow-hidden border border-[#080E1C] hover:bg-[#080E1C]/80 transition-all duration-300 transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              style={{ maskImage: "radial-gradient(circle at left 50%, transparent 6px, black 7px), radial-gradient(circle at right 50%, transparent 6px, black 7px)", maskComposite: "intersect" }}
            >

              {/* Vertical dashed divider for tear-off stub */}
              <div className="absolute right-12 top-0 bottom-0 border-r border-dashed border-[#F2EFE9]/20"></div>

              <span className="font-mono text-[10px] tracking-[0.15em] uppercase pl-2 relative z-10 font-bold">{loading ? 'Issuing...' : 'Issue Boarding Pass'}</span>
              <div className="w-8 flex justify-center relative z-10 text-[#5CDDB5]">
                <span className="material-symbols-outlined text-[20px] -rotate-45">confirmation_number</span>
              </div>
            </button>
          </div>

          {/* Secondary Action */}
          <div className="text-center pt-6 border-t border-dashed border-[#F2EFE9]/10">
            <p className="font-body text-[13px] text-[#F2EFE9]/70">
              Already holding a ticket?
              <Link href="/login" className="font-mono text-[10px] text-[#5CDDB5] hover:text-[#F2EFE9] transition-colors ml-2 uppercase tracking-widest font-bold">Embark Here</Link>
            </p>
          </div>
        </form>
      </main>

      {/* Pirate Parrot Mascot */}
      <div className="fixed bottom-8 right-8 z-50 hidden lg:flex items-end gap-4 pointer-events-none group">
        {/* Speech Bubble (Hidden until hover) */}
        <div className="opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 ease-out bg-[#1E1A11] text-[#F2EFE9] p-6 rounded-3xl rounded-br-sm border-2 border-[#5CDDB5] shadow-[0_10px_40px_rgba(0,0,0,0.5)] relative mb-16 max-w-[380px] pointer-events-none">
          <p className="font-body text-[14px] leading-relaxed">
            <strong className="text-[#5CDDB5] font-display text-xl block mb-2 tracking-wider">Squawk! Welcome aboard! 🦜</strong>
            The <strong className="text-[#F2EFE9]">Swayam Splitter</strong> be the finest ledger on the seven seas! Use it to track your crew's shared expenses, split tabs fairly, and settle debts using the Smuggler's Link. <br /><br />
            Pay up on time to earn Doubloons, spend 'em in the Shipwright's Shop to buy shiny new avatars, and keep yourself off the Infamy board. Settle up or walk the plank!
          </p>
          {/* Bubble Tail */}
          <div className="absolute -bottom-2.5 right-10 w-5 h-5 bg-[#1E1A11] border-b-2 border-r-2 border-[#5CDDB5] transform rotate-45"></div>
        </div>

        {/* Parrot Image */}
        <BottomSheetTooltip text="Polly the Quartermaster">
          <div className="w-40 h-40 relative flex-shrink-0 rounded-full border-4 border-[#5CDDB5] border-dashed overflow-hidden bg-white shadow-[0_0_30px_rgba(92,221,181,0.3)] pointer-events-auto hover:scale-110 hover:rotate-6 transition-all duration-300 cursor-help">
            <img src="/pirate_parrot.png" alt="Pirate Parrot" className="w-full h-full object-cover transform scale-125 translate-y-2" />
          </div>
        </BottomSheetTooltip>
      </div>
    </div>
  );
}
