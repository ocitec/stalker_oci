'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { useAuthStore } from '@/lib/store/auth.store';

// ── Loading skeleton shown while Zustand rehydrates from localStorage ─────────
// Matches the dashboard shell dimensions so there is no layout shift.
function HydrationSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-0)' }}>
      {/* Sidebar skeleton */}
      <div
        className="flex-shrink-0 border-r"
        style={{ width: 220, background: 'var(--bg-1)', borderColor: 'var(--border)' }}
      >
        {/* Logo area */}
        <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="skeleton w-8 h-8 rounded-lg" />
            <div className="space-y-1.5">
              <div className="skeleton h-3 w-16 rounded" />
              <div className="skeleton h-2 w-20 rounded" />
            </div>
          </div>
        </div>
        {/* Nav items */}
        <div className="p-3 space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-8 rounded-lg" style={{ opacity: 1 - i * 0.08 }} />
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Topbar skeleton */}
        <div
          className="flex-shrink-0 flex items-center px-6 gap-4 border-b"
          style={{ height: 52, background: 'var(--bg-1)', borderColor: 'var(--border)' }}
        >
          <div className="skeleton h-4 w-40 rounded" />
          <div className="flex-1" />
          <div className="skeleton h-5 w-12 rounded-full" />
          <div className="skeleton h-4 w-20 rounded" />
          <div className="skeleton w-6 h-6 rounded-full" />
        </div>

        {/* Page content skeleton */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-5">
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-24 rounded-xl" />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="skeleton h-56 rounded-xl" />
              <div className="skeleton h-56 rounded-xl" />
            </div>
            <div className="skeleton h-64 rounded-xl" />
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router         = useRouter();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const hasHydrated    = useAuthStore(s => s._hasHydrated);

  useEffect(() => {
    // Only redirect after Zustand has finished reading localStorage.
    // Without this guard, the effect fires on the first render when the
    // store still holds its default (logged-out) values, causing every
    // page reload to redirect to /login even for authenticated users.
    if (hasHydrated && !isAuthenticated) {
      router.replace('/login');
    }
  }, [hasHydrated, isAuthenticated, router]);

  // Zustand hasn't read localStorage yet — show a shell skeleton.
  // This takes < 50ms in practice and prevents the redirect race condition.
  if (!hasHydrated) {
    return <HydrationSkeleton />;
  }

  // Hydrated but not authenticated — render nothing while the effect
  // above triggers the redirect. Prevents a flash of the dashboard UI.
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-0)' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}