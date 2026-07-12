'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { User, Lock, Activity, Eye, EyeOff, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { profileApi } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth.store';
import { fmtDate, fmtRelative } from '@/lib/utils';
import { SkeletonTable } from '@/components/ui';

const ACTION_LABELS: Record<string, string> = {
  LOGIN:                    'Signed in',
  PASSWORD_CHANGED:         'Changed password',
  PASSWORD_RESET_REQUESTED: 'Requested password reset',
  PASSWORD_RESET_COMPLETED: 'Reset password',
  PROFILE_UPDATED:          'Updated profile',
  ROLE_CHANGED:             'Role changed',
};

type Tab = 'profile' | 'password' | 'activity';

export default function ProfilePage() {
  const qc            = useQueryClient();
  const { user: me }  = useAuthStore();
  const [tab, setTab] = useState<Tab>('profile');

  // ── Profile data ──────────────────────────────────────────────────────────
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn:  () => profileApi.get().then(r => r.data?.data),
  });

  // ── Profile edit ──────────────────────────────────────────────────────────
  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');
  const [editInit, setEditInit] = useState(false);

  if (profile && !editInit) {
    setName(profile.name ?? '');
    setEmail(profile.email ?? '');
    setEditInit(true);
  }

  const updateProfile = useMutation({
    mutationFn: () => profileApi.update({ name: name.trim(), email: email.trim() }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['profile'] }); toast.success('Profile updated'); },
    onError:    (e: any) => toast.error(e.response?.data?.message ?? 'Update failed'),
  });

  // ── Password change ───────────────────────────────────────────────────────
  const [curPass,  setCurPass]  = useState('');
  const [newPass,  setNewPass]  = useState('');
  const [confPass, setConfPass] = useState('');
  const [showPass, setShowPass] = useState(false);

  const changePass = useMutation({
    mutationFn: () => {
      if (newPass !== confPass) throw new Error('Passwords do not match');
      if (newPass.length < 8)  throw new Error('Password must be at least 8 characters');
      return profileApi.changePassword(curPass, newPass);
    },
    onSuccess: () => {
      toast.success('Password changed successfully');
      setCurPass(''); setNewPass(''); setConfPass('');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? e.message ?? 'Failed'),
  });

  // ── Activity log ──────────────────────────────────────────────────────────
  const [actPage, setActPage] = useState(1);

  const { data: actData, isLoading: actLoading } = useQuery({
    queryKey: ['activity', actPage],
    queryFn:  () => profileApi.activity(actPage, 15).then(r => r.data?.data),
    enabled:  tab === 'activity',
  });

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'profile',  label: 'Profile',       icon: User     },
    { id: 'password', label: 'Password',      icon: Lock     },
    { id: 'activity', label: 'Activity Log',  icon: Activity },
  ];

  const roleMeta: Record<string, { color: string; bg: string }> = {
    ADMIN:   { color: '#EF4444', bg: 'rgba(239,68,68,0.1)'  },
    CFO:     { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
    FINANCE: { color: '#6366F1', bg: 'rgba(99,102,241,0.1)' },
    SALES:   { color: '#22C55E', bg: 'rgba(34,197,94,0.1)'  },
  };
  const rMeta = roleMeta[me?.role ?? 'FINANCE'] ?? roleMeta.FINANCE;

  return (
    <div className="space-y-4 animate-fade-in max-w-2xl">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black flex-shrink-0"
          style={{ background: rMeta.bg, color: rMeta.color }}>
          {(me?.name ?? 'U').slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>{me?.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: rMeta.bg, color: rMeta.color }}>
              {me?.role}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{me?.organization?.name}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all"
            style={{
              color:       tab === t.id ? 'var(--indigo-2)' : 'var(--text-3)',
              borderBottom: tab === t.id ? '2px solid var(--indigo-2)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            <t.icon size={13} />{t.label}
          </button>
        ))}
      </div>

      {/* ── Profile Tab ── */}
      {tab === 'profile' && (
        <div className="card p-6 space-y-5">
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="skeleton h-10 rounded-lg" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Full Name</label>
                  <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Email Address</label>
                  <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Role</label>
                  <div className="form-input opacity-60 cursor-not-allowed">{me?.role}</div>
                </div>
                <div>
                  <label className="form-label">Organisation</label>
                  <div className="form-input opacity-60 cursor-not-allowed">{me?.organization?.name}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Last Login</label>
                  <div className="form-input opacity-60 cursor-not-allowed">{profile?.lastLoginAt ? fmtRelative(profile.lastLoginAt) : '—'}</div>
                </div>
                <div>
                  <label className="form-label">Member Since</label>
                  <div className="form-input opacity-60 cursor-not-allowed">{profile?.createdAt ? fmtDate(profile.createdAt) : '—'}</div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => updateProfile.mutate()}
                  disabled={updateProfile.isPending}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'var(--indigo)', color: '#fff' }}
                >
                  {updateProfile.isPending ? <><Loader2 size={13} className="animate-spin" />Saving…</> : 'Save changes'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Password Tab ── */}
      {tab === 'password' && (
        <div className="card p-6 space-y-4">
          <div className="p-3 rounded-lg text-xs" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--text-2)' }}>
            Your password must be at least 8 characters. After changing, you'll remain logged in on this device.
          </div>

          <div>
            <label className="form-label">Current password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={curPass}
                onChange={e => setCurPass(e.target.value)}
                className="form-input pr-10"
                placeholder="Enter current password"
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                style={{ color: 'var(--text-3)' }}>
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label className="form-label">New password</label>
            <input
              type={showPass ? 'text' : 'password'}
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              className="form-input"
              placeholder="Min. 8 characters"
            />
          </div>

          <div>
            <label className="form-label">Confirm new password</label>
            <input
              type={showPass ? 'text' : 'password'}
              value={confPass}
              onChange={e => setConfPass(e.target.value)}
              className="form-input"
              placeholder="Repeat new password"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => changePass.mutate()}
              disabled={changePass.isPending || !curPass || !newPass || !confPass}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--indigo)', color: '#fff' }}
            >
              {changePass.isPending ? <><Loader2 size={13} className="animate-spin" />Updating…</> : 'Update password'}
            </button>
          </div>
        </div>
      )}

      {/* ── Activity Tab ── */}
      {tab === 'activity' && (
        <div className="card overflow-hidden">
          {actLoading ? (
            <SkeletonTable rows={8} />
          ) : !actData?.logs?.length ? (
            <div className="py-12 text-center">
              <Activity size={28} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--text-3)' }} />
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>No activity recorded yet</p>
            </div>
          ) : (
            <>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Action', 'Entity', 'Date'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {actData.logs.map((log: any) => (
                    <tr key={log.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-3)' }}>
                        {log.entity}{log.entityId ? ` · ${log.entityId.slice(0, 8)}…` : ''}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-3)' }}>
                        {fmtRelative(log.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {actData.pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                    Page {actData.page} of {actData.pages} · {actData.total} events
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setActPage(p => Math.max(1, p - 1))}
                      disabled={actData.page === 1}
                      className="p-1.5 rounded transition-all hover:opacity-70 disabled:opacity-30"
                      style={{ color: 'var(--text-3)' }}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      onClick={() => setActPage(p => Math.min(actData.pages, p + 1))}
                      disabled={actData.page === actData.pages}
                      className="p-1.5 rounded transition-all hover:opacity-70 disabled:opacity-30"
                      style={{ color: 'var(--text-3)' }}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
