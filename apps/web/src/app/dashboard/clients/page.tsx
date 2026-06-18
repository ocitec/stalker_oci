'use client';

import { useState } from 'react';
import { Search, Plus, ShieldOff, ShieldCheck, Building2, Download, Pencil } from 'lucide-react';
import { useClients, useBlockClient, useUnblockClient } from '@/lib/hooks/useApi';
import { Badge, SkeletonTable, GhostButton, AmberButton, EmptyState, PdiBar } from '@/components/ui';
import { fmtCurrency, getPdiColor, getPdiLabel, getRiskBadgeClass } from '@/lib/utils';
import { Client } from '@/types';
import { AddClientModal }  from '@/components/forms/AddClientModal';
import { EditClientModal } from '@/components/forms/EditClientModal';
import { ClientDrawer }    from '@/components/forms/ClientDrawer';
import { InvoiceDrawer }   from '@/components/forms/InvoiceDrawer';

function exportCsv(clients: Client[]) {
  const header = ['Name','Email','Sector','PDI','Risk','Credit Limit','Outstanding','Utilisation %','SLA Days','Status'];
  const rows   = clients.map(c => [
    c.name, c.email ?? '', c.sector ?? '',
    Math.round(Number(c.paymentDisciplineIndex)),
    c.riskStatus, c.creditLimit,
    c.outstandingAmount ?? 0, c.utilizationPercent ?? 0,
    c.slaDays, c.isBlocked ? 'BLOCKED' : 'ACTIVE',
  ]);
  const csv  = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: `clients-${new Date().toISOString().split('T')[0]}.csv` }).click();
  URL.revokeObjectURL(url);
}

export default function ClientsPage() {
  const [search,    setSearch]    = useState('');
  const [risk,      setRisk]      = useState('');
  const [isBlocked, setBlocked]   = useState<boolean | undefined>(undefined);
  const [page,      setPage]      = useState(1);
  const [addOpen,   setAddOpen]   = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [clientId,  setClientId]  = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  const blockClient   = useBlockClient();
  const unblockClient = useUnblockClient();

  const PAGE_SIZE = 20;
  const { data, isLoading } = useClients({
    search: search || undefined,
    riskStatus: risk || undefined,
    isBlocked,
    page,
    limit: PAGE_SIZE,
  });

  const clients: Client[] = (data as any)?.data ?? (Array.isArray(data) ? data : []);
  const meta = (data as any)?.meta;

  return (
    <>
    <div className="space-y-4 animate-fade-in">

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
          <input
            className="pl-8 pr-3 py-2 rounded-lg text-xs outline-none w-56"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            placeholder="Search client…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="px-3 py-2 rounded-lg text-xs outline-none" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          value={risk} onChange={e => { setRisk(e.target.value); setPage(1); }}>
          <option value="">All Risk Levels</option>
          {['RELIABLE','MODERATE','HIGH_RISK','CHRONIC'].map(r => <option key={r} value={r}>{r.replace('_',' ')}</option>)}
        </select>
        <select className="px-3 py-2 rounded-lg text-xs outline-none" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          value={isBlocked === undefined ? '' : String(isBlocked)} onChange={e => { setBlocked(e.target.value === '' ? undefined : e.target.value === 'true'); setPage(1); }}>
          <option value="">All Clients</option>
          <option value="false">Active</option>
          <option value="true">Blocked</option>
        </select>
        <div className="flex-1" />
        <GhostButton onClick={() => clients.length > 0 && exportCsv(clients)} disabled={clients.length === 0}>
          <Download size={12} className="inline mr-1" />Export CSV
        </GhostButton>
        <AmberButton onClick={() => setAddOpen(true)}>
          <Plus size={12} className="inline mr-1" />Add Client
        </AmberButton>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? <SkeletonTable rows={8} /> : clients.length === 0 ? (
          <EmptyState icon={<Building2 size={32} />} title="No clients found" sub="Add your first corporate client" />
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Client','Sector','PDI','Risk','Outstanding','Credit Limit','Util.','SLA',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map(c => {
                const pdi      = Math.round(Number(c.paymentDisciplineIndex));
                const utilPct  = c.utilizationPercent ?? 0;
                const utilColor = utilPct > 80 ? '#F43F5E' : utilPct > 50 ? '#F59E0B' : '#10B981';
                return (
                  <tr key={c.id} onClick={() => setClientId(c.id)}
                    className="border-b cursor-pointer hover:opacity-90 transition-all" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{ background: `${getPdiColor(pdi)}22`, color: getPdiColor(pdi) }}>
                          {c.name.slice(0,2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text)' }}>{c.name}</p>
                          {c.isBlocked && <span className="text-[9px]" style={{ color: '#F43F5E' }}>● BLOCKED</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-3)' }}>{c.sector ?? '—'}</td>
                    <td className="px-4 py-3"><PdiBar value={pdi} color={getPdiColor(pdi)} /></td>
                    <td className="px-4 py-3"><Badge className={getRiskBadgeClass(c.riskStatus)}>{getPdiLabel(pdi)}</Badge></td>
                    <td className="px-4 py-3 mono font-semibold" style={{ color: 'var(--text)' }}>{fmtCurrency(c.outstandingAmount ?? 0)}</td>
                    <td className="px-4 py-3 mono" style={{ color: 'var(--text-3)' }}>{fmtCurrency(Number(c.creditLimit))}</td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="h-1.5 w-16 rounded-full mb-0.5" style={{ background: 'var(--bg-3)' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, utilPct)}%`, background: utilColor }} />
                        </div>
                        <span className="mono text-[10px]" style={{ color: utilColor }}>{utilPct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 mono" style={{ color: 'var(--text-2)' }}>{c.slaDays}d</td>
                    {/* Actions — stop row click propagation */}
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1.5">
                        {/* Edit */}
                        <button
                          onClick={() => setEditClient(c)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold hover:opacity-80 transition-all"
                          style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}
                        >
                          <Pencil size={10} />Edit
                        </button>
                        {/* Block / Unblock */}
                        {!c.isBlocked ? (
                          <button
                            onClick={() => blockClient.mutate({ id: c.id, reason: 'Manual block' })}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold hover:opacity-80 transition-all"
                            style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E' }}
                          >
                            <ShieldOff size={10} />Block
                          </button>
                        ) : (
                          <button
                            onClick={() => unblockClient.mutate({ id: c.id })}
                            disabled={unblockClient.isPending}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold hover:opacity-80 transition-all disabled:opacity-40"
                            style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}
                          >
                            <ShieldCheck size={10} />Unblock
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-xs" style={{ borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--text-3)' }}>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, meta.total)} of {meta.total} clients
            </span>
            <div className="flex items-center gap-1">
              <GhostButton onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</GhostButton>
              {Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
                const pg = Math.max(1, Math.min(meta.totalPages - 4, page - 2)) + i;
                return pg <= meta.totalPages ? (
                  <button key={pg} onClick={() => setPage(pg)}
                    className="w-7 h-7 rounded text-[11px] font-medium transition-all"
                    style={{ background: pg === page ? 'var(--amber)' : 'transparent', color: pg === page ? '#000' : 'var(--text-3)' }}>
                    {pg}
                  </button>
                ) : null;
              })}
              <GhostButton onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}>Next →</GhostButton>
            </div>
          </div>
        )}
      </div>
    </div>
    <AddClientModal  open={addOpen}       onClose={() => setAddOpen(false)} />
      <EditClientModal client={editClient}  onClose={() => setEditClient(null)} />
      <ClientDrawer    clientId={clientId}  onClose={() => setClientId(null)}
        onViewInvoice={id => { setClientId(null); setInvoiceId(id); }} />
      <InvoiceDrawer   invoiceId={invoiceId} onClose={() => setInvoiceId(null)} />
    </>
  );
}