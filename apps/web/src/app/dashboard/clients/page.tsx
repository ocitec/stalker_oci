'use client';

import { useState } from 'react';
import { Search, Plus, ShieldOff, ShieldCheck, Building2, Download, Pencil } from 'lucide-react';
import { useClients, useBlockClient, useUnblockClient } from '@/lib/hooks/useApi';
import { Badge, GhostButton, EmptyState, PdiBar, PageHeader, Toolbar, Button, ResponsiveTable, Column } from '@/components/ui';
import { fmtCurrency, getPdiColor, getPdiLabel, getRiskBadgeClass } from '@/lib/utils';
import { Client } from '@/types';
import { AddClientModal }  from '@/components/forms/AddClientModal';
import { EditClientModal } from '@/components/forms/EditClientModal';
import { ClientDrawer }    from '@/components/forms/ClientDrawer';
import { InvoiceDrawer }   from '@/components/forms/InvoiceDrawer';

function exportCsv(clients: Client[]) {
  const header = ['Name','Email','Sector','PDI','Risk','Credit Limit','Outstanding','Utilisation %','SLA Days','Status'];
  const rows   = clients.map(c => [
    c.name, c.email ?? '', c.sector ?? '', Math.round(Number(c.paymentDisciplineIndex)),
    c.riskStatus, c.creditLimit, c.outstandingAmount ?? 0, c.utilizationPercent ?? 0,
    c.slaDays, c.isBlocked ? 'BLOCKED' : 'ACTIVE',
  ]);
  const csv  = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: `clients-${new Date().toISOString().split('T')[0]}.csv` }).click();
  URL.revokeObjectURL(url);
}

const PAGE_SIZE = 20;

export default function ClientsPage() {
  const [search,     setSearch]     = useState('');
  const [risk,       setRisk]       = useState('');
  const [isBlocked,  setBlocked]    = useState<boolean | undefined>(undefined);
  const [page,       setPage]       = useState(1);
  const [addOpen,    setAddOpen]    = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [clientId,   setClientId]   = useState<string | null>(null);
  const [invoiceId,  setInvoiceId]  = useState<string | null>(null);

  const blockClient   = useBlockClient();
  const unblockClient = useUnblockClient();

  const { data, isLoading } = useClients({ search: search || undefined, riskStatus: risk || undefined, isBlocked, page, limit: PAGE_SIZE });
  const clients: Client[] = (data as any)?.data ?? (Array.isArray(data) ? data : []);
  const meta = (data as any)?.meta;

  const columns: Column<Client>[] = [
    { key: 'name', header: 'Client', primary: true, render: c => {
        const pdi = Math.round(Number(c.paymentDisciplineIndex));
        return (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: `${getPdiColor(pdi)}22`, color: getPdiColor(pdi) }}>{c.name.slice(0,2).toUpperCase()}</div>
            <div><p className="font-medium" style={{ color: 'var(--text)' }}>{c.name}</p>{c.isBlocked && <span className="text-[9px]" style={{ color: '#F43F5E' }}>● BLOCKED</span>}</div>
          </div>
        );
      } },
    { key: 'sector', header: 'Sector', hideOnMobile: true, render: c => c.sector ?? '—' },
    { key: 'pdi', header: 'PDI', render: c => { const pdi = Math.round(Number(c.paymentDisciplineIndex)); return <PdiBar value={pdi} color={getPdiColor(pdi)} />; } },
    { key: 'risk', header: 'Risk', render: c => <Badge className={getRiskBadgeClass(c.riskStatus)}>{getPdiLabel(Math.round(Number(c.paymentDisciplineIndex)))}</Badge> },
    { key: 'outstanding', header: 'Outstanding', align: 'right', render: c => <span className="mono font-semibold">{fmtCurrency(c.outstandingAmount ?? 0)}</span> },
    { key: 'creditLimit', header: 'Credit Limit', align: 'right', hideOnMobile: true, render: c => <span className="mono" style={{ color: 'var(--text-3)' }}>{fmtCurrency(Number(c.creditLimit))}</span> },
    { key: 'util', header: 'Util.', align: 'right', hideOnMobile: true, render: c => {
        const u = c.utilizationPercent ?? 0; const col = u > 100 ? '#F43F5E' : u > 80 ? '#F59E0B' : 'var(--text-3)';
        return <span className="mono text-[11px]" style={{ color: col }}>{u}%</span>;
      } },
    { key: 'sla', header: 'SLA', align: 'right', hideOnMobile: true, render: c => <span className="mono" style={{ color: 'var(--text-2)' }}>{c.slaDays}d</span> },
  ];

  const rowActions = (c: Client) => (
    <div className="flex gap-1.5 justify-end">
      <button onClick={() => setEditClient(c)} className="chip" style={{ minHeight: 32, color: '#3B82F6' }}><Pencil size={11} /> Edit</button>
      {!c.isBlocked
        ? <button onClick={() => blockClient.mutate({ id: c.id, reason: 'Manual block' })} className="chip" style={{ minHeight: 32, color: '#F43F5E' }}><ShieldOff size={11} /> Block</button>
        : <button onClick={() => unblockClient.mutate({ id: c.id })} disabled={unblockClient.isPending} className="chip" style={{ minHeight: 32, color: '#10B981' }}><ShieldCheck size={11} /> Unblock</button>}
    </div>
  );

  return (
    <>
      <div className="animate-fade-in">
        <PageHeader title="Clients" subtitle="Corporate accounts, risk and exposure"
          actions={<>
            <GhostButton onClick={() => clients.length > 0 && exportCsv(clients)} disabled={clients.length === 0}><Download size={12} className="inline mr-1" />Export</GhostButton>
            <Button onClick={() => setAddOpen(true)} blockMobile><Plus size={15} /> Add Client</Button>
          </>} />

        <Toolbar className="mb-4">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
            <input className="form-input" style={{ paddingLeft: 34 }} placeholder="Search client…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="form-input sm:w-40" value={risk} onChange={e => { setRisk(e.target.value); setPage(1); }}>
            <option value="">All Risk Levels</option>
            {['RELIABLE','MODERATE','HIGH_RISK','CHRONIC'].map(r => <option key={r} value={r}>{r.replace('_',' ')}</option>)}
          </select>
          <select className="form-input sm:w-36" value={isBlocked === undefined ? '' : String(isBlocked)} onChange={e => { setBlocked(e.target.value === '' ? undefined : e.target.value === 'true'); setPage(1); }}>
            <option value="">All Clients</option>
            <option value="false">Active</option>
            <option value="true">Blocked</option>
          </select>
        </Toolbar>

        <ResponsiveTable columns={columns} rows={clients} loading={isLoading} onRowClick={c => setClientId(c.id)} rowActions={rowActions}
          empty={<div className="card"><EmptyState icon={<Building2 size={32} />} title="No clients found" sub="Add your first corporate client" /></div>} />

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-xs flex-wrap gap-2">
            <span style={{ color: 'var(--text-3)' }}>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, meta.total)} of {meta.total}</span>
            <div className="flex items-center gap-1">
              <GhostButton onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</GhostButton>
              <GhostButton onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}>Next →</GhostButton>
            </div>
          </div>
        )}
      </div>
      <AddClientModal  open={addOpen}       onClose={() => setAddOpen(false)} />
      <EditClientModal client={editClient}  onClose={() => setEditClient(null)} />
      <ClientDrawer    clientId={clientId}  onClose={() => setClientId(null)} onViewInvoice={id => { setClientId(null); setInvoiceId(id); }} />
      <InvoiceDrawer   invoiceId={invoiceId} onClose={() => setInvoiceId(null)} />
    </>
  );
}
