'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      router.push('/dashboard');
    } catch (err: any) {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background min-h-screen flex items-center justify-center p-4 md:p-6 relative overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-90" 
        style={{ backgroundImage: "url('/signup_castle_bg.jpg')" }}
      ></div>
      
      {/* Main Login Card */}
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
          <h1 className="font-display text-4xl text-[#F2EFE9] mb-2 font-bold tracking-tight">The Swayam splitter</h1>
          <p className="font-body text-sm text-[#F2EFE9]/80 italic relative inline-block mb-4">
            Passenger Manifest
          </p>
          <div className="flex justify-center">
             <svg width="60" height="8" viewBox="0 0 60 8" fill="none" xmlns="http://www.w3.org/2000/svg" suppressHydrationWarning>
                <path d="M0 4 Q 7.5 0, 15 4 T 30 4 T 45 4 T 60 4" stroke="#F2EFE9" strokeOpacity="0.15" strokeWidth="1" fill="none" suppressHydrationWarning/>
             </svg>
          </div>
        </header>

        {error && (
          <div className="p-4 mb-6 relative z-20 rounded text-sm text-center bg-[#F5C3C3] text-[#A63A3A] border border-[#A63A3A]/20">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-8 relative z-20">
          
          {/* Email Input */}
          <div className="relative group">
            <label className="font-mono text-[10px] uppercase tracking-widest text-[#F2EFE9]/70 block mb-2 font-bold" htmlFor="email">Telegraph Address (Email)</label>
            <div className="relative">
              <input 
                id="email" 
                type="email" 
                placeholder="captain@maritima.com" 
                className="w-full bg-transparent border-0 border-b border-[#F2EFE9]/20 focus:border-[#F2EFE9] focus:ring-0 py-2 pl-0 pr-8 font-body text-[15px] text-[#F2EFE9] placeholder:italic placeholder:text-[#F2EFE9]/40 transition-colors focus:outline-none" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <span 
                className="material-symbols-outlined absolute right-0 bottom-2 text-[#F2EFE9]/40 group-focus-within:text-[#F2EFE9] transition-colors cursor-pointer text-[20px]"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'visibility' : 'visibility_off'}
              </span>
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
              
              <span className="font-mono text-[10px] tracking-[0.15em] uppercase pl-2 relative z-10 font-bold">{loading ? 'Embarking...' : 'Embark'}</span>
              <div className="w-8 flex justify-center relative z-10 text-[#5CDDB5]">
                <span className="material-symbols-outlined text-[20px] -rotate-45">confirmation_number</span>
              </div>
            </button>
          </div>

          {/* Secondary Action */}
          <div className="text-center pt-6 border-t border-dashed border-[#F2EFE9]/10">
            <p className="font-body text-[13px] text-[#F2EFE9]/70">
              Misplaced Ticket? 
              <Link href="/signup" className="font-mono text-[10px] text-[#5CDDB5] hover:text-[#F2EFE9] transition-colors ml-2 uppercase tracking-widest font-bold">New Passenger</Link>
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}
