'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, CheckCheck, AlertTriangle, Clock, TrendingDown, Shield } from 'lucide-react';
import { useAlerts, useMarkAllRead, useMarkRead } from '@/lib/hooks/useApi';
import { GhostButton, EmptyState } from '@/components/ui';
import { fmtRelative } from '@/lib/utils';
import { AlertType } from '@/types';

const ALERT_META: Record<AlertType, { label: string; color: string; bg: string; borderColor: string }> = {
  OVERDUE:             { label: 'Overdue',        color: '#F43F5E', bg: 'rgba(244,63,94,0.08)',  borderColor: '#F43F5E' },
  DUE_TODAY:           { label: 'Due Today',       color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', borderColor: '#F59E0B' },
  DUE_1_DAY:           { label: 'Due Tomorrow',    color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', borderColor: '#F59E0B' },
  DUE_3_DAYS:          { label: 'Due in 3 Days',   color: '#3B82F6', bg: 'rgba(59,130,246,0.08)', borderColor: '#3B82F6' },
  DUE_7_DAYS:          { label: 'Due in 7 Days',   color: '#3B82F6', bg: 'rgba(59,130,246,0.08)', borderColor: '#3B82F6' },
  FOLLOW_UP_STALE:     { label: 'Stale Follow-up', color: '#F43F5E', bg: 'rgba(244,63,94,0.08)',  borderColor: '#F43F5E' },
  PDI_THRESHOLD:       { label: 'PDI Warning',     color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', borderColor: '#F59E0B' },
  CREDIT_LIMIT_BREACH: { label: 'Credit Breach',   color: '#F43F5E', bg: 'rgba(244,63,94,0.08)',  borderColor: '#F43F5E' },
};

const ALERT_ICON: Record<string, React.ReactNode> = {
  OVERDUE:             <AlertTriangle size={14} />,
  DUE_TODAY:           <Clock size={14} />,
  DUE_1_DAY:           <Clock size={14} />,
  DUE_3_DAYS:          <Bell size={14} />,
  DUE_7_DAYS:          <Bell size={14} />,
  FOLLOW_UP_STALE:     <TrendingDown size={14} />,
  PDI_THRESHOLD:       <Shield size={14} />,
  CREDIT_LIMIT_BREACH: <Shield size={14} />,
};

// Which alert types navigate to follow-ups vs invoices
const FOLLOWUP_TYPES = new Set(['FOLLOW_UP_STALE', 'OVERDUE']);

const FILTER_TABS = [
  { label: 'All',      value: '' },
  { label: 'Unread',   value: 'unread' },
  { label: 'Critical', value: 'critical' },
  { label: 'Pre-Due',  value: 'predue' },
];

export default function AlertsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState('');
  const markAllRead = useMarkAllRead();
  const markRead    = useMarkRead();

  const { data: unreadAlerts, isLoading } = useAlerts({ isRead: false });
  const { data: readAlerts }              = useAlerts({ isRead: true });

  const allAlerts = [...(unreadAlerts ?? []), ...(filter === 'unread' ? [] : readAlerts ?? [])];

  const filtered = allAlerts.filter(a => {
    if (filter === 'unread')   return !a.isRead;
    if (filter === 'critical') return ['OVERDUE', 'FOLLOW_UP_STALE', 'CREDIT_LIMIT_BREACH'].includes(a.alertType);
    if (filter === 'predue')   return ['DUE_7_DAYS', 'DUE_3_DAYS', 'DUE_1_DAY', 'DUE_TODAY'].includes(a.alertType);
    return true;
  });

  const unreadCount = (unreadAlerts ?? []).length;

  function handleTakeAction(alertId: string, alertType: AlertType) {
    // Mark as read then navigate
    markRead.mutate(alertId);
    if (FOLLOWUP_TYPES.has(alertType)) {
      router.push('/dashboard/followups');
    } else {
      router.push('/dashboard/invoices');
    }
  }

  function handleDismiss(alertId: string) {
    markRead.mutate(alertId);
  }

  return (
    <div className="max-w-3xl space-y-4 animate-fade-in">

      {/* Filter tabs + mark-all-read */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className="px-4 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: filter === tab.value ? 'var(--bg-3)' : 'transparent',
                color:      filter === tab.value ? 'var(--amber)' : 'var(--text-3)',
                border:     `1px solid ${filter === tab.value ? 'var(--border-2)' : 'transparent'}`,
              }}
            >
              {tab.label}
              {tab.value === 'unread' && unreadCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] bg-red-500 text-white font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="flex items-center gap-1.5 text-xs font-medium transition-all hover:opacity-70"
            style={{ color: 'var(--text-3)' }}
          >
            <CheckCheck size={13} />
            Mark all read
          </button>
        )}
      </div>

      {/* Alert list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-4">
              <div className="skeleton h-4 w-64 mb-2" />
              <div className="skeleton h-3 w-full mb-1" />
              <div className="skeleton h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<BellOff size={36} />} title="No alerts" sub="You're all caught up. Stalker is watching." />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(alert => {
            const meta = ALERT_META[alert.alertType as AlertType] ?? ALERT_META.OVERDUE;
            return (
              <div
                key={alert.id}
                className="card p-4 border-l-2 transition-all"
                style={{
                  borderLeftColor: meta.borderColor,
                  background:      alert.isRead ? 'var(--bg-1)' : 'var(--bg-2)',
                  opacity:         alert.isRead ? 0.65 : 1,
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: meta.bg, color: meta.color }}
                  >
                    {ALERT_ICON[alert.alertType] ?? <Bell size={14} />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{ background: meta.bg, color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        {!alert.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-3)' }}>
                        {fmtRelative(alert.sentAt)}
                      </span>
                    </div>

                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text)' }}>
                      {alert.invoice?.client?.name ?? 'Unknown Client'}
                      {alert.invoice?.invoiceNumber && (
                        <span className="mono ml-2 font-normal text-[11px]" style={{ color: 'var(--text-3)' }}>
                          {alert.invoice.invoiceNumber}
                        </span>
                      )}
                    </p>

                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
                      {alert.message}
                    </p>

                    {!alert.isRead && (
                      <div className="flex gap-2 mt-2.5">
                        <button
                          onClick={() => handleTakeAction(alert.id, alert.alertType)}
                          disabled={markRead.isPending}
                          className="text-[10px] px-2.5 py-1 rounded font-semibold hover:opacity-80 transition-all disabled:opacity-50"
                          style={{ background: meta.bg, color: meta.color }}
                        >
                          Take Action
                        </button>
                        <button
                          onClick={() => handleDismiss(alert.id)}
                          disabled={markRead.isPending}
                          className="text-[10px] px-2.5 py-1 rounded font-medium hover:opacity-80 transition-all disabled:opacity-50"
                          style={{ background: 'var(--bg-3)', color: 'var(--text-3)' }}
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
