'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users, Plus, X, UserCheck, UserX, Mail, ChevronDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api/client';
import { AmberButton, GhostButton, Badge, EmptyState, SkeletonTable, SectionTitle } from '@/components/ui';
import { fmtDate, fmtRelative } from '@/lib/utils';

type UserRole = 'ADMIN' | 'CFO' | 'FINANCE' | 'SALES';

const ROLE_META: Record<UserRole, { label: string; color: string; bg: string; desc: string }> = {
  ADMIN:   { label: 'Admin',   color: '#F43F5E', bg: 'rgba(244,63,94,0.1)',   desc: 'Full access including user management' },
  CFO:     { label: 'CFO',     color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  desc: 'All reports + block/unblock clients' },
  FINANCE: { label: 'Finance', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)',  desc: 'Create invoices, log follow-ups' },
  SALES:   { label: 'Sales',   color: '#10B981', bg: 'rgba(16,185,129,0.1)',  desc: 'Read-only access' },
};

const usersApi = {
  list:       ()                              => api.get('/users'),
  deactivate: (id: string)                   => api.patch(`/users/${id}/deactivate`),
  activate:   (id: string)                   => api.patch(`/users/${id}/activate`),
  invite:     (d: { name: string; email: string; role: UserRole }) => api.post('/users/invite', d),
  updateRole: (id: string, role: UserRole)   => api.patch(`/users/${id}/role`, { role }),
};

// ── Invite Modal — rendered through a portal so it always overlays correctly ──
function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc     = useQueryClient();
  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');
  const [role,  setRole]  = useState<UserRole>('FINANCE');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const invite = useMutation({
    mutationFn: (d: { name: string; email: string; role: UserRole }) => usersApi.invite(d),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Invitation sent'); onClose(); },
    onError:    (e: any) => toast.error(e.response?.data?.message ?? 'Failed to send invitation'),
  });

  useEffect(() => {
    if (open) { setName(''); setEmail(''); setRole('FINANCE'); setErrors({}); }
  }, [open]);

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim())                              e.name  = 'Name is required';
    if (!email || !/^\S+@\S+\.\S+$/.test(email))  e.email = 'Enter a valid email';
    setErrors(e);
    return !Object.keys(e).length;
  }

  if (!open) return null;

  const modal = (
    <div
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ zIndex: 9999 }}
    >
      <div
        className="animate-scale-in w-full rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-1)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
              <Mail size={15} style={{ color: 'var(--indigo-2)' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Invite Team Member</h2>
              <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>They'll receive an email to set their password</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-70"
            style={{ background: 'var(--bg-3)' }}>
            <X size={14} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="form-label">Full Name</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Amaka Obi" />
            {errors.name && <p className="form-error">{errors.name}</p>}
          </div>
          <div>
            <label className="form-label">Email Address</label>
            <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="amaka@company.ng" />
            {errors.email && <p className="form-error">{errors.email}</p>}
          </div>
          <div>
            <label className="form-label">Role &amp; Permissions</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(ROLE_META) as UserRole[]).map(r => {
                const m = ROLE_META[r];
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className="p-3 rounded-lg text-left transition-all"
                    style={{
                      background: role === r ? m.bg : 'var(--bg-2)',
                      border: `1px solid ${role === r ? m.color + '55' : 'var(--border)'}`,
                    }}
                  >
                    <p className="text-xs font-bold" style={{ color: role === r ? m.color : 'var(--text)' }}>{m.label}</p>
                    <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-3)' }}>{m.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <AmberButton
            onClick={() => { if (validate()) invite.mutate({ name: name.trim(), email: email.trim(), role }); }}
            disabled={invite.isPending}
          >
            {invite.isPending ? 'Sending…' : 'Send Invitation'}
          </AmberButton>
        </div>
      </div>
    </div>
  );

  // Portal to document.body so it never gets clipped by a parent's overflow
  return typeof window !== 'undefined' ? createPortal(modal, document.body) : null;
}

// ── Role change dropdown ──────────────────────────────────────────────────────
function RoleDropdown({ userId, currentRole }: { userId: string; currentRole: UserRole }) {
  const qc     = useQueryClient();
  const [open, setOpen] = useState(false);

  const changeRole = useMutation({
    mutationFn: (role: UserRole) => usersApi.updateRole(userId, role),
    onSuccess:  (_d, role) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(`Role updated to ${ROLE_META[role].label}`);
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to update role'),
  });

  const meta = ROLE_META[currentRole];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-all hover:opacity-80"
        style={{ background: meta.bg, color: meta.color }}
      >
        {meta.label}
        <ChevronDown size={9} />
      </button>
      {open && (
        <>
          {/* Click-outside backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 mt-1 rounded-lg overflow-hidden z-50"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', width: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
          >
            {(Object.keys(ROLE_META) as UserRole[]).map(r => {
              const m = ROLE_META[r];
              return (
                <button
                  key={r}
                  onClick={() => changeRole.mutate(r)}
                  disabled={r === currentRole || changeRole.isPending}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs transition-all hover:opacity-80 disabled:opacity-40"
                  style={{ background: r === currentRole ? 'var(--bg-3)' : 'transparent' }}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
                  <span style={{ color: r === currentRole ? m.color : 'var(--text-2)' }}>{m.label}</span>
                  {r === currentRole && <span className="text-[9px] ml-auto" style={{ color: 'var(--text-3)' }}>current</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const qc          = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn:  () => usersApi.list().then(r => r.data?.data as any[]),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User deactivated'); },
    onError:    (e: any) => toast.error(e.response?.data?.message ?? 'Failed'),
  });

  const activate = useMutation({
    mutationFn: (id: string) => usersApi.activate(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User reactivated'); },
    onError:    (e: any) => toast.error(e.response?.data?.message ?? 'Failed'),
  });

  const users       = (data ?? []).filter((u: any) => !roleFilter || u.role === roleFilter);
  const activeCount = (data ?? []).filter((u: any) => u.isActive).length;

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Role filter tabs */}
        <div className="flex gap-1.5">
          {([{ label: 'All', value: '' }, ...Object.entries(ROLE_META).map(([v, m]) => ({ label: m.label, value: v }))]).map(tab => (
            <button
              key={tab.value}
              onClick={() => setRoleFilter(tab.value as UserRole | '')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: roleFilter === tab.value ? 'var(--bg-3)' : 'transparent',
                color:      roleFilter === tab.value ? 'var(--indigo-2)' : 'var(--text-3)',
                border:     `1px solid ${roleFilter === tab.value ? 'var(--border-2)' : 'transparent'}`,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-xs" style={{ color: 'var(--text-3)' }}>
          {activeCount} active · {data?.length ?? 0} total
        </span>
        <AmberButton onClick={() => setInviteOpen(true)}>
          <Plus size={12} className="inline mr-1" />Invite Member
        </AmberButton>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? <SkeletonTable rows={5} /> : users.length === 0 ? (
          <EmptyState icon={<Users size={32} />} title="No team members found" sub="Invite your first team member above" />
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Member', 'Role', 'Status', 'Last Login', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => {
                const roleMeta = ROLE_META[u.role as UserRole] ?? ROLE_META.FINANCE;
                return (
                  <tr key={u.id} className="border-b hover:opacity-80 transition-all" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                          style={{ background: roleMeta.bg, color: roleMeta.color }}>
                          {(u.name ?? 'U').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold" style={{ color: 'var(--text)' }}>{u.name}</p>
                          <p style={{ color: 'var(--text-3)' }}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    {/* Role — click to change (ADMIN only ideally) */}
                    <td className="px-4 py-3">
                      <RoleDropdown userId={u.id} currentRole={u.role as UserRole} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${u.isActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span style={{ color: u.isActive ? '#10B981' : '#F43F5E' }}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-3)' }}>
                      {u.lastLoginAt ? fmtRelative(u.lastLoginAt) : 'Never'}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-3)' }}>
                      {u.createdAt ? fmtDate(u.createdAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <button
                          onClick={() => deactivate.mutate(u.id)}
                          disabled={deactivate.isPending}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold hover:opacity-80 transition-all disabled:opacity-40"
                          style={{ background: 'rgba(244,63,94,0.1)', color: '#F43F5E' }}
                        >
                          <UserX size={10} />Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => activate.mutate(u.id)}
                          disabled={activate.isPending}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold hover:opacity-80 transition-all disabled:opacity-40"
                          style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}
                        >
                          <UserCheck size={10} />Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}