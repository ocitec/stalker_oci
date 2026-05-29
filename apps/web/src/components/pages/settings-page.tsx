'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Building2, Bell, Shield, Clock } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api/client';
import { AmberButton, GhostButton } from '@/components/ui';
import { useAuthStore } from '@/lib/store/auth.store';

// ── API ──────────────────────────────────────────────────────────────────────
const settingsApi = {
  get:    ()           => api.get('/organization/settings'),
  update: (data: any)  => api.patch('/organization/settings', data),
};

// ── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULTS = {
  defaultSlaDays:       30,
  pdiAutoBlockThreshold: 30,
  followUpStaleDays:    5,
  alertPre7Days:        true,
  alertPre3Days:        true,
  alertPre1Day:         true,
  alertOverdue:         true,
  alertPdiWarning:      true,
  alertStaleFollowUp:   true,
  orgName:              '',
  orgIndustry:          '',
};

type SettingsState = typeof DEFAULTS;

// ── Setting Row component ─────────────────────────────────────────────────────
function SettingRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="flex-1 pr-6">
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{sub}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative flex-shrink-0 w-10 h-5 rounded-full transition-all"
      style={{ background: checked ? 'var(--amber)' : 'var(--bg-3)' }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
        style={{
          background: '#fff',
          left: checked ? 'calc(100% - 18px)' : 2,
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  );
}

// ── Number Input ──────────────────────────────────────────────────────────────
function NumInput({
  value, onChange, min, max, suffix,
}: { value: number; onChange: (v: number) => void; min: number; max: number; suffix?: string }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        className="form-input mono text-right w-20"
        style={{ padding: '6px 10px' }}
        min={min}
        max={max}
        value={value}
        onChange={e => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n) && n >= min && n <= max) onChange(n);
        }}
      />
      {suffix && <span className="text-xs" style={{ color: 'var(--text-3)' }}>{suffix}</span>}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'CFO';

  const [form,    setForm]    = useState<SettingsState>(DEFAULTS);
  const [isDirty, setIsDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['org-settings'],
    queryFn:  () => settingsApi.get().then(r => r.data.data),
  });

  useEffect(() => {
    if (data) {
      setForm({ ...DEFAULTS, ...data });
      setIsDirty(false);
    }
  }, [data]);

  const update = useMutation({
    mutationFn: (d: SettingsState) => settingsApi.update(d),
    onSuccess:  () => { toast.success('Settings saved'); setIsDirty(false); },
    onError:    (e: any) => toast.error(e.response?.data?.message ?? 'Failed to save settings'),
  });

  function set<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }

  function handleReset() {
    if (data) { setForm({ ...DEFAULTS, ...data }); setIsDirty(false); }
  }

  const sections = [
    {
      icon:  <Building2 size={15} />,
      title: 'Organisation',
      color: 'var(--amber)',
      rows:  [
        <SettingRow key="orgName" label="Organisation Name" sub="Your company's trading name">
          <input
            className="form-input w-56 text-right"
            style={{ padding: '6px 10px' }}
            value={form.orgName}
            disabled={!isAdmin}
            onChange={e => set('orgName', e.target.value)}
            placeholder="Zenith Corp"
          />
        </SettingRow>,
        <SettingRow key="orgIndustry" label="Industry" sub="Your primary business sector">
          <input
            className="form-input w-56 text-right"
            style={{ padding: '6px 10px' }}
            value={form.orgIndustry}
            disabled={!isAdmin}
            onChange={e => set('orgIndustry', e.target.value)}
            placeholder="Manufacturing"
          />
        </SettingRow>,
      ],
    },
    {
      icon:  <Clock size={15} />,
      title: 'Payment & Credit Defaults',
      color: '#3B82F6',
      rows:  [
        <SettingRow key="sla" label="Default SLA Days" sub="Applied to new clients when no SLA is specified">
          <NumInput value={form.defaultSlaDays} onChange={v => set('defaultSlaDays', v)} min={1} max={180} suffix="days" />
        </SettingRow>,
        <SettingRow key="stale" label="Follow-up Stale Threshold" sub="Days after which an overdue invoice with no follow-up is flagged">
          <NumInput value={form.followUpStaleDays} onChange={v => set('followUpStaleDays', v)} min={1} max={30} suffix="days" />
        </SettingRow>,
      ],
    },
    {
      icon:  <Shield size={15} />,
      title: 'Risk & Compliance',
      color: '#F43F5E',
      rows:  [
        <SettingRow key="pdi" label="PDI Auto-block Threshold" sub="Clients with PDI below this value are automatically blocked from new credit">
          <div className="flex flex-col items-end gap-1">
            <NumInput value={form.pdiAutoBlockThreshold} onChange={v => set('pdiAutoBlockThreshold', v)} min={0} max={60} />
            <div className="w-32 h-1.5 rounded-full" style={{ background: 'var(--bg-3)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${(form.pdiAutoBlockThreshold / 100) * 100}%`, background: '#F43F5E' }}
              />
            </div>
          </div>
        </SettingRow>,
      ],
    },
    {
      icon:  <Bell size={15} />,
      title: 'Alert Notifications',
      color: 'var(--amber)',
      rows:  [
        <SettingRow key="a7" label="7-Day Pre-Due Alerts" sub="Notify when invoices are due in 7 days">
          <Toggle checked={form.alertPre7Days} onChange={v => set('alertPre7Days', v)} />
        </SettingRow>,
        <SettingRow key="a3" label="3-Day Pre-Due Alerts" sub="Notify when invoices are due in 3 days">
          <Toggle checked={form.alertPre3Days} onChange={v => set('alertPre3Days', v)} />
        </SettingRow>,
        <SettingRow key="a1" label="1-Day Pre-Due Alerts" sub="Notify the day before an invoice is due">
          <Toggle checked={form.alertPre1Day} onChange={v => set('alertPre1Day', v)} />
        </SettingRow>,
        <SettingRow key="aov" label="Overdue Invoice Alerts" sub="Notify when invoices cross their due date without payment">
          <Toggle checked={form.alertOverdue} onChange={v => set('alertOverdue', v)} />
        </SettingRow>,
        <SettingRow key="apdi" label="PDI Warning Alerts" sub="Notify when a client's PDI drops toward the auto-block threshold">
          <Toggle checked={form.alertPdiWarning} onChange={v => set('alertPdiWarning', v)} />
        </SettingRow>,
        <SettingRow key="asf" label="Stale Follow-up Alerts" sub="Notify when overdue invoices exceed the stale follow-up threshold">
          <Toggle checked={form.alertStaleFollowUp} onChange={v => set('alertStaleFollowUp', v)} />
        </SettingRow>,
      ],
    },
  ];

  return (
    <div className="max-w-2xl space-y-5 animate-fade-in">

      {!isAdmin && (
        <div
          className="p-3 rounded-lg text-xs"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--text-2)' }}
        >
          🔒 Settings are read-only for your role. Contact an Admin or CFO to make changes.
        </div>
      )}

      {sections.map(section => (
        <div key={section.title} className="card p-5">
          <div className="flex items-center gap-2 mb-2 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${section.color}22`, color: section.color }}
            >
              {section.icon}
            </div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{section.title}</h3>
          </div>
          <div>
            {section.rows.map((row, i) => {
              // Remove border from last row
              if (i === section.rows.length - 1) {
                return (
                  <div key={i} style={{ borderBottom: 'none' }}>
                    {row}
                  </div>
                );
              }
              return row;
            })}
          </div>
        </div>
      ))}

      {/* Save bar */}
      {isAdmin && isDirty && (
        <div
          className="sticky bottom-4 flex items-center justify-between px-5 py-3 rounded-xl"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--amber)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
        >
          <p className="text-xs" style={{ color: 'var(--text-2)' }}>
            You have unsaved changes
          </p>
          <div className="flex gap-2">
            <GhostButton onClick={handleReset}>
              <RotateCcw size={11} className="inline mr-1" />Discard
            </GhostButton>
            <AmberButton onClick={() => update.mutate(form)} disabled={update.isPending}>
              <Save size={11} className="inline mr-1" />
              {update.isPending ? 'Saving…' : 'Save Changes'}
            </AmberButton>
          </div>
        </div>
      )}
    </div>
  );
}
