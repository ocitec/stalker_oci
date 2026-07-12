'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, RefreshCw, Menu } from 'lucide-react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useUnreadCount } from '@/lib/hooks/useApi';

const pageTitles: Record<string, { title: string; sub: string }> = {
  '/dashboard':          { title: 'Executive Dashboard', sub: 'Real-time cash control overview' },
  '/dashboard/alerts':   { title: 'Alert Centre',        sub: 'Pre-due & overdue notifications' },
  '/dashboard/invoices': { title: 'Invoice Manager',     sub: 'Manage and track all invoices' },
  '/dashboard/clients':  { title: 'Client Registry',     sub: 'Corporate debtor management' },
  '/dashboard/followups':{ title: 'Follow-up Clock',     sub: 'Track last contact times' },
  '/dashboard/pdi':      { title: 'PDI Rankings',        sub: 'Payment Discipline Index' },
  '/dashboard/sla':      { title: 'SLA Violations',      sub: 'Breach tracking & analysis' },
  '/dashboard/ai':       { title: 'AI Insights',         sub: 'Predictive payment intelligence' },
  '/dashboard/profile':  { title: 'My Profile',          sub: 'Account settings and activity' },
  '/dashboard/reports':  { title: 'Reports',             sub: 'Generate and export data reports' },
  '/dashboard/users':    { title: 'Team',                sub: 'Manage team members and roles' },
  '/dashboard/settings': { title: 'Settings',            sub: 'Organisation settings' },
};

interface TopbarProps {
  onMenuToggle?: () => void;
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const pathname   = usePathname();
  const qc         = useQueryClient();
  const [time, setTime]         = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { data: unread } = useUnreadCount();

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries();
    setTimeout(() => setRefreshing(false), 800);
  };

  const page = pageTitles[pathname] ?? { title: 'Dashboard', sub: '' };

  return (
    <header
      className="flex-shrink-0 flex items-center px-4 gap-3 border-b"
      style={{ background: 'var(--bg-1)', borderColor: 'var(--border)', height: '52px' }}
    >
      {/* Hamburger — mobile only */}
      {onMenuToggle && (
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-1.5 rounded-lg transition-all hover:opacity-70 flex-shrink-0"
          style={{ color: 'var(--text-3)' }}
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
      )}

      <div className="flex items-baseline gap-2 min-w-0">
        <h1 className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{page.title}</h1>
        <span className="text-xs hidden sm:block flex-shrink-0" style={{ color: 'var(--text-3)' }}>{page.sub}</span>
      </div>

      <div className="flex-1" />

      {/* Live badge — hidden on very small screens */}
      <div
        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0"
        style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--green)' }}
      >
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--green)' }} />
        Live
      </div>

      {/* Clock */}
      <span className="mono text-[11px] hidden md:block flex-shrink-0" style={{ color: 'var(--text-3)' }}>{time} WAT</span>

      {/* Refresh */}
      <button
        onClick={handleRefresh}
        className="p-1.5 rounded-lg transition-all hover:opacity-70 flex-shrink-0"
        style={{ color: 'var(--text-3)' }}
      >
        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
      </button>

      {/* Alert bell */}
      <Link href="/dashboard/alerts" className="relative p-1.5 rounded-lg transition-all hover:opacity-70 flex-shrink-0">
        <Bell size={16} style={{ color: 'var(--text-3)' }} />
        {(unread as number) > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-full bg-red-500 text-white">
            {Math.min(99, unread as number)}
          </span>
        )}
      </Link>
    </header>
  );
}
