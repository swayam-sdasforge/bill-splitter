import Link from 'next/link';

export default function RightsPage() {
  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col md:flex-row selection:bg-secondary-container selection:text-on-secondary-container">
      {/* SideNavBar (Desktop Only) */}
      <nav 
        className="hidden md:flex flex-col h-screen fixed left-0 top-0 z-40 w-72 border-r-2 border-double border-outline-variant bg-surface-container bg-cover bg-center shadow-[4px_0_15px_-3px_rgba(88,28,135,0.08)]"
        style={{ backgroundImage: "linear-gradient(rgba(26, 24, 32, 0.85), rgba(26, 24, 32, 0.85)), url('/retro_castle_bg.png')" }}
      >
        <div className="p-container-margin border-b border-outline-variant border-dashed">
          <h1 className="font-headline-lg text-headline-lg font-bold text-primary">Purser&apos;s Office</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Passenger Rights
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
            <span className="material-symbols-outlined text-6xl text-secondary mb-4">description</span>
            <h2 className="font-display-lg text-5xl md:text-6xl text-secondary mb-2 font-bold tracking-tight">Passenger Rights</h2>
            <p className="font-mono text-sm text-primary uppercase tracking-widest">Your Protections on the High Seas</p>
          </header>

          <article className="space-y-8 text-lg text-on-surface leading-relaxed">
            
            <section className="bg-surface-container-low border border-outline-variant rounded p-6 shadow-sm">
              <h3 className="font-display text-3xl font-bold text-primary-container mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">receipt_long</span>
                Right to a Transparent Ledger
              </h3>
              <p>
                Every crew member and passenger has the undeniable right to view the Voyage Ledger in its entirety. No Captain may hide expenses, manipulate entries, or falsely claim a bounty without it being permanently etched into the public ship log for all to see.
              </p>
            </section>

            <section className="bg-surface-container-low border border-outline-variant rounded p-6 shadow-sm">
              <h3 className="font-display text-3xl font-bold text-primary-container mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">money_off</span>
                Right to Refuse Unjust Debts
              </h3>
              <p>
                A passenger is only accountable for the exact arithmetic share of communal expenses. If a stowaway or crewmate attempts to invoice you for rum you did not drink or supplies you did not use, you hold the right to petition the Captain for a manual ledger adjustment.
              </p>
            </section>

            <section className="bg-surface-container-low border border-outline-variant rounded p-6 shadow-sm">
              <h3 className="font-display text-3xl font-bold text-primary-container mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">waving_hand</span>
                Right to Disembark
              </h3>
              <p>
                Any passenger may request to leave the voyage (the group) at any port of call, provided they have fully settled their debts with the crew. A passenger cannot be held aboard a vessel against their will if their balance reads zero.
              </p>
            </section>

            <section className="bg-surface-container-low border border-outline-variant rounded p-6 shadow-sm">
              <h3 className="font-display text-3xl font-bold text-primary-container mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">chat_bubble_outline</span>
                Right to Secure Comms
              </h3>
              <p>
                Your transmissions within the encrypted Chat Room are strictly meant for your specific crew. The Admiralty guarantees that your voyage's wireless frequency will not be broadcast to the open ocean, ensuring your crew's plans remain secure from rival fleets.
              </p>
            </section>

          </article>
          
          <div className="mt-12 text-center border-t border-dashed border-outline-variant pt-8">
            <p className="font-mono text-sm text-on-surface-variant opacity-70">
              For disputes, contact the Harbor Master or invoke an Admiralty Court hearing.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
