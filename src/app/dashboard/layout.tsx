'use client';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Pass through layout to let the exact Stitch UI pages render their own sidebars
  return (
    <div className="w-full min-h-screen">
      {children}
    </div>
  );
}
