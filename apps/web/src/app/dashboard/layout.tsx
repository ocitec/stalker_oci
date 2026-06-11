'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ShieldAlert } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { useAuthStore } from '@/lib/store/auth.store';
import { useIdleTimeout } from '@/lib/hooks/useIdleTimeout';
import { authApi } from '@/lib/api/client';

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

const WARNING_SECS = 60;

// ── Idle warning dialog ───────────────────────────────────────────────────────
function IdleWarningDialog({ countdown, onStay, onLogout }: {
  countdown: number;
  onStay:    () => void;
  onLogout:  () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="w-[360px] rounded-xl p-6 flex flex-col gap-4 shadow-2xl border"
        style={{ background: 'var(--bg-1)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(245,158,11,0.12)' }}>
            <ShieldAlert size={18} style={{ color: 'var(--amber)' }} />
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Session expiring soon</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              You'll be logged out in <span className="font-bold tabular-nums" style={{ color: 'var(--amber)' }}>{countdown}s</span> due to inactivity.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onStay}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'var(--amber)', color: '#000' }}
          >
            Stay logged in
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-opacity hover:opacity-70"
            style={{ background: 'var(--bg-3)', color: 'var(--text-2)' }}
          >
            <LogOut size={13} />
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router          = useRouter();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const hasHydrated     = useAuthStore(s => s._hasHydrated);
  const refreshToken    = useAuthStore(s => s.refreshToken);
  const clearAuth       = useAuthStore(s => s.clearAuth);

  const [showWarning, setShowWarning] = useState(false);
  const [countdown,   setCountdown]   = useState(WARNING_SECS);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const performLogout = useCallback(async () => {
    stopCountdown();
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } finally {
      clearAuth();
      window.location.href = '/login';
    }
  }, [refreshToken, clearAuth, stopCountdown]);

  const handleWarning = useCallback(() => {
    setShowWarning(true);
    setCountdown(WARNING_SECS);
    stopCountdown();
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          stopCountdown();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, [stopCountdown]);

  const handleStay = useCallback(() => {
    stopCountdown();
    setShowWarning(false);
    setCountdown(WARNING_SECS);
  }, [stopCountdown]);

  // Trigger logout when countdown reaches 0
  useEffect(() => {
    if (countdown === 0 && showWarning) {
      performLogout();
    }
  }, [countdown, showWarning, performLogout]);

  useIdleTimeout({
    enabled:   hasHydrated && isAuthenticated,
    onWarning: handleWarning,
    onActive:  handleStay,
    onIdle:    performLogout,
  });

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.replace('/login');
    }
  }, [hasHydrated, isAuthenticated, router]);

  if (!hasHydrated) return <HydrationSkeleton />;
  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-0)' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {showWarning && (
        <IdleWarningDialog
          countdown={countdown}
          onStay={handleStay}
          onLogout={performLogout}
        />
      )}
    </div>
  );
}