import Link from 'next/link';

export default function PolicyPage() {
  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col md:flex-row selection:bg-secondary-container selection:text-on-secondary-container">
      {/* SideNavBar (Desktop Only) */}
      <nav 
        className="hidden md:flex flex-col h-screen fixed left-0 top-0 z-40 w-72 border-r-2 border-double border-outline-variant bg-surface-container bg-cover bg-center shadow-[4px_0_15px_-3px_rgba(88,28,135,0.08)]"
        style={{ backgroundImage: "linear-gradient(rgba(26, 24, 32, 0.85), rgba(26, 24, 32, 0.85)), url('/retro_castle_bg.png')" }}
      >
        <div className="p-container-margin border-b border-outline-variant border-dashed">
          <h1 className="font-headline-lg text-headline-lg font-bold text-primary">Captain&apos;s Quarters</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Maritime Rules
          </p>
        </div>
        <div className="flex-1 overflow-y-auto py-unit-8 flex flex-col gap-2 px-unit">
          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:text-primary hover:bg-secondary-container/50 transition-colors duration-300">
            <span className="material-symbols-outlined" data-icon="anchor">anchor</span>
            <span className="font-label-sm text-label-sm">Home</span>
          </Link>
          <Link href="/dashboard/groups" className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:text-primary hover:bg-secondary-container/50 transition-colors duration-300">
            <span className="material-symbols-outlined" data-icon="group">group</span>
            <span className="font-label-sm text-label-sm">Groups</span>
          </Link>
          <Link href="/dashboard/chat" className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:text-primary hover:bg-secondary-container/50 transition-colors duration-300">
            <span className="material-symbols-outlined text-green-500 animate-pulse" data-icon="chat">chat</span>
            <span className="font-label-sm text-label-sm font-bold text-green-500">Global Chat</span>
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 md:ml-72 flex flex-col min-h-screen relative bg-surface-dim overflow-hidden">
        {/* Retro Castle & Currency Background */}
        <div
          className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: "url('/castle_currency_bg.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
        ></div>

        <div className="absolute inset-0 z-0 bg-surface/60 pointer-events-none"></div>

        <div className="flex-1 p-gutter md:p-container-margin pb-section-gap relative z-10 max-w-4xl w-full mx-auto">
          <header className="mb-section-gap text-center py-8 border-b-4 border-double border-outline-variant">
            <span className="material-symbols-outlined text-6xl text-primary mb-4">gavel</span>
            <h2 className="font-display-lg text-5xl md:text-6xl text-primary mb-2 font-bold tracking-tight">Ship&apos;s Policy</h2>
            <p className="font-mono text-sm text-secondary uppercase tracking-widest">Articles of Agreement & Maritime Law</p>
          </header>

          <article className="space-y-8 text-lg text-on-surface leading-relaxed">
            
            <section className="bg-surface-container-low border border-outline-variant rounded p-6 shadow-sm">
              <h3 className="font-display text-3xl font-bold text-primary-container mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">stars</span>
                1. The Captain&apos;s Authority
              </h3>
              <p>
                The Captain of the Voyage (the original creator of the ledger group) holds the ultimate authority over the ship&apos;s log. Any attempts at mutiny—including but not limited to tampering with the application, exploiting vulnerabilities, or attempting unauthorized access—will result in you being forced to walk the plank (immediate account termination).
              </p>
            </section>

            <section className="bg-surface-container-low border border-outline-variant rounded p-6 shadow-sm">
              <h3 className="font-display text-3xl font-bold text-primary-container mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">inventory_2</span>
                2. Cargo Manifest & Privacy
              </h3>
              <p>
                Your personal effects, financial ledgers, and wireless communications are securely locked in the Ship&apos;s vault. We strictly do not sell your cargo or data to pirates, privateers, or third-party merchants. Your email and designated Passenger Name are solely utilized to verify your ticket and identify you to your fellow crewmates.
              </p>
            </section>

            <section className="bg-surface-container-low border border-outline-variant rounded p-6 shadow-sm">
              <h3 className="font-display text-3xl font-bold text-primary-container mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">balance</span>
                3. Fair Winds & Equal Shares
              </h3>
              <p>
                The Swayam Splitter calculates all outstanding debts using strict, immutable maritime mathematics. All passengers and crew are expected to pay their fair share of the rations and supplies. Note: The software and its creators are not liable if a passenger jumps ship or deserts without settling their financial obligations.
              </p>
            </section>

            <section className="bg-surface-container-low border border-outline-variant rounded p-6 shadow-sm">
              <h3 className="font-display text-3xl font-bold text-primary-container mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">cell_tower</span>
                4. Wireless Room Etiquette
              </h3>
              <p>
                The Global Comms frequency (Encrypted Chat Room) is strictly designated for coordinating settlements, relaying voyage details, and ship-wide camaraderie. Spamming the wireless room, attempting to intercept other voyages&apos; frequencies, or sending hostile transmissions will result in a permanent revoking of your telegraph privileges.
              </p>
            </section>

            <section className="bg-surface-container-low border border-outline-variant rounded p-6 shadow-sm">
              <h3 className="font-display text-3xl font-bold text-primary-container mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">luggage</span>
                5. Stowaways & Guests
              </h3>
              <p>
                Crew members are permitted to bring stowaways (Guest Passengers) aboard the voyage. However, the registered crew member who adds a stowaway assumes full financial and legal responsibility for their share of the loot, expenses, and actions aboard the vessel.
              </p>
            </section>

          </article>
          
          <div className="mt-12 text-center">
            <p className="font-mono text-sm text-on-surface-variant opacity-70">
              By boarding this vessel and utilizing The Swayam Splitter, you agree to abide by these Articles.
            </p>
            <p className="font-mono text-sm text-on-surface-variant opacity-70 mt-2">
              Signed, The Admiralty
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
