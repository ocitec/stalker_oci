'use client';

import { useState } from 'react';
import { X, Copy, CheckCircle2, GitMerge } from 'lucide-react';
import { useClientDuplicates, useMergeClients } from '@/lib/hooks/useApi';
import { GhostButton } from '@/components/ui';
import { fmtDate } from '@/lib/utils';

interface Props {
  open:     boolean;
  onClose:  () => void;
  canMerge: boolean;   // true only for ADMIN (merge endpoint is Admin-only)
}

// ── One duplicate group with survivor selection + merge ──────────────────────
function DuplicateGroup({ group, canMerge }: { group: any; canMerge: boolean }) {
  const merge = useMergeClients();
  const [survivorId, setSurvivorId] = useState<string>(group.suggestedSurvivorId);
  const duplicateIds: string[] = group.clients.map((c: any) => c.id).filter((id: string) => id !== survivorId);
  const survivorName = group.clients.find((c: any) => c.id === survivorId)?.name ?? 'survivor';

  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{group.name}</p>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E' }}>
          {group.count} records
        </span>
      </div>

      <div className="space-y-1.5 mb-3">
        {group.clients.map((c: any) => {
          const isSurvivor = c.id === survivorId;
          return (
            <label key={c.id} className="flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-all"
              style={{
                background: isSurvivor ? 'rgba(16,185,129,0.08)' : 'transparent',
                border: `1px solid ${isSurvivor ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
              }}>
              <input
                type="radio"
                name={`survivor-${group.suggestedSurvivorId}`}
                checked={isSurvivor}
                onChange={() => setSurvivorId(c.id)}
                className="mt-0.5"
                style={{ accentColor: '#10B981' }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                  {c.name}
                  {isSurvivor && (
                    <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>KEEP</span>
                  )}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {c.counts.invoices} inv · {c.counts.transactions} txn · {c.counts.salesRequests + c.counts.creditRequests} req
                  {' · '}{c.companyRegistration || 'no reg'}{' · '}added {fmtDate(c.createdAt)}
                </p>
              </div>
            </label>
          );
        })}
      </div>

      {canMerge ? (
        <button
          onClick={() => merge.mutate({ survivorId, duplicateIds })}
          disabled={merge.isPending || duplicateIds.length === 0}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-90 disabled:opacity-40"
          style={{ background: 'var(--indigo)', color: '#fff' }}
        >
          <GitMerge size={13} />
          {merge.isPending ? 'Merging…' : `Merge ${duplicateIds.length} into "${survivorName}"`}
        </button>
      ) : (
        <p className="text-[10px] text-center py-1" style={{ color: 'var(--text-3)' }}>
          Admin access required to merge duplicates
        </p>
      )}
    </div>
  );
}

export function DuplicateClientsModal({ open, onClose, canMerge }: Props) {
  const { data, isLoading } = useClientDuplicates(open);
  const groups: any[] = data?.duplicateGroups ?? [];

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="animate-scale-in w-full max-w-lg rounded-xl"
        style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
          style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(244,63,94,0.12)' }}>
              <Copy size={15} style={{ color: '#F43F5E' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Duplicate Clients</h2>
              <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>Pick the record to keep, then merge the rest into it</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-70" style={{ background: 'var(--bg-3)' }}>
            <X size={14} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          {isLoading ? (
            <p className="text-xs text-center py-8" style={{ color: 'var(--text-3)' }}>Scanning for duplicates…</p>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <CheckCircle2 size={32} style={{ color: '#10B981' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>No duplicate clients</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Every client name is unique.</p>
            </div>
          ) : (
            <>
              <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                Merging moves all invoices, SLA violations, sales/credit requests and transactions to the kept
                record, recalculates its PDI, then deletes the duplicates. This cannot be undone.
              </p>
              {groups.map((g, i) => (
                <DuplicateGroup key={g.suggestedSurvivorId ?? i} group={g} canMerge={canMerge} />
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 sticky bottom-0"
          style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border)' }}>
          <GhostButton onClick={onClose}>Close</GhostButton>
        </div>
      </div>
    </div>
  );
}
