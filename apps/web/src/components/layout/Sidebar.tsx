'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard, Bell, FileText, Building2,
  Clock, BarChart3, AlertTriangle, Sparkles,
  LogOut, Settings, ChevronRight, Users, Sun, Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth.store';
import { useUnreadCount } from '@/lib/hooks/useApi';
import { authApi } from '@/lib/api/client';

// nav groups are built dynamically based on role — see Sidebar component below
const BASE_NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard',        icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/dashboard/alerts', icon: Bell,            label: 'Alerts',    badge: 'alerts' },
    ],
  },
  {
    label: 'Receivables',
    items: [
      { href: '/dashboard/invoices',  icon: FileText,  label: 'Invoices' },
      { href: '/dashboard/clients',   icon: Building2, label: 'Clients' },
      { href: '/dashboard/followups', icon: Clock,     label: 'Follow-ups' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/dashboard/pdi', icon: BarChart3,     label: 'PDI Rankings' },
      { href: '/dashboard/sla', icon: AlertTriangle, label: 'SLA Violations' },
      { href: '/dashboard/ai',  icon: Sparkles,      label: 'AI Insights' },
    ],
  },
];

const ADMIN_GROUP = {
  label: 'Administration',
  items: [
    { href: '/dashboard/users',    icon: Users,    label: 'Team' },
    { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
  ],
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, refreshToken, clearAuth } = useAuthStore();
  const { data: unreadCount } = useUnreadCount();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme !== 'light';

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } finally {
      clearAuth();
      window.location.href = '/login';
    }
  };

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href);

  // Build nav with Administration group visible to ADMIN + CFO
  const navGroups = [
    ...BASE_NAV_GROUPS,
    ...(user?.role === 'ADMIN' || user?.role === 'CFO' ? [ADMIN_GROUP] : [
      // Finance and Sales can still reach Settings (read-only)
      { label: 'Administration', items: [{ href: '/dashboard/settings', icon: Settings, label: 'Settings' }] },
    ]),
  ];

  return (
    <aside
      className="w-[220px] min-w-[220px] flex flex-col border-r overflow-y-auto"
      style={{ background: 'var(--bg-1)', borderColor: 'var(--border)' }}
    >
      {/* Logo */}
      <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-sm"
            style={{ background: 'var(--indigo)' }}
          >
            S1
          </div>
          <div>
            <p className="font-bold text-sm tracking-tight" style={{ color: 'var(--text)' }}>STALKER</p>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Cash Control</p>
          </div>
        </div>
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 py-2">
        {navGroups.map(group => (
          <div key={group.label} className="px-2 py-2">
            <p className="px-2 pb-1.5 text-[10px] uppercase tracking-widest font-medium" style={{ color: 'var(--text-3)' }}>
              {group.label}
            </p>
            {group.items.map(item => {
              const active = isActive(item.href);
              const count  = (item as any).badge === 'alerts' ? (unreadCount as number | undefined) ?? 0 : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href as any}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm mb-0.5 transition-all duration-150',
                    active ? 'font-semibold' : 'hover:opacity-100',
                  )}
                  style={{
                    color:      active ? 'var(--indigo-2)' : 'var(--text-2)',
                    background: active ? 'var(--bg-3)' : 'transparent',
                  }}
                >
                  <item.icon size={15} />
                  <span className="flex-1">{item.label}</span>
                  {count > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/90 text-white">
                      {count}
                    </span>
                  )}
                  {active && <ChevronRight size={12} style={{ color: 'var(--indigo-2)' }} />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
            style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--indigo-2)' }}
          >
            {user?.name?.slice(0, 2).toUpperCase() ?? 'US'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{user?.name}</p>
            <p className="text-[10px] truncate" style={{ color: 'var(--text-3)' }}>
              {user?.role} · {user?.organization?.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 mb-1">
          {mounted && (
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="flex items-center gap-1.5 flex-1 px-2 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
              style={{ color: 'var(--text-3)' }}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun size={13} /> : <Moon size={13} />}
              {isDark ? 'Light mode' : 'Dark mode'}
            </button>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
            style={{ color: 'var(--text-3)' }}
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
