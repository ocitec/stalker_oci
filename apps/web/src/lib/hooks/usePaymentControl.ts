import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { suppliersApi, accountsApi, replenishmentsApi, paymentsApi } from '@/lib/api/client';

export const PQK = {
  suppliers:      (p?: any) => ['suppliers', p],
  accounts:       (p?: any) => ['operational-accounts', p],
  account:        (id: string) => ['operational-accounts', id],
  replenishments: (p?: any) => ['replenishments', p],
  payments:       (p?: any) => ['payment-requests', p],
  payment:        (id: string) => ['payment-requests', id],
  payDashboard:   ['payment-requests', 'dashboard'],
  exceptions:     (s?: string) => ['payment-exceptions', s],
};

const err = (e: any, f: string) => toast.error(e.response?.data?.message || f);

function invalidatePayments(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['payment-requests'] });
  qc.invalidateQueries({ queryKey: ['operational-accounts'] });
  qc.invalidateQueries({ queryKey: ['replenishments'] });
  qc.invalidateQueries({ queryKey: ['payment-exceptions'] });
}

// ── Suppliers ────────────────────────────────────────────────────────────────
export function useSuppliers(params?: any) {
  return useQuery({ queryKey: PQK.suppliers(params), queryFn: () => suppliersApi.list(params).then(r => r.data.data) });
}
export function useSupplierAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, id, payload }: { action: string; id?: string; payload?: any }) =>
      action === 'create' ? suppliersApi.create(payload).then(r => r.data.data)
                          : suppliersApi.update(id!, payload).then(r => r.data.data),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success(`Supplier ${v.action === 'create' ? 'created' : 'updated'}`); },
    onError: (e: any) => err(e, 'Supplier action failed'),
  });
}

// ── Operational accounts ─────────────────────────────────────────────────────
export function useAccounts(params?: any) {
  return useQuery({ queryKey: PQK.accounts(params), queryFn: () => accountsApi.list(params).then(r => r.data.data) });
}
export function useAccountAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, id, payload }: { action: string; id?: string; payload?: any }) =>
      action === 'create' ? accountsApi.create(payload).then(r => r.data.data)
                          : accountsApi.update(id!, payload).then(r => r.data.data),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['operational-accounts'] }); qc.invalidateQueries({ queryKey: PQK.payDashboard }); toast.success(`Account ${v.action === 'create' ? 'created' : 'updated'}`); },
    onError: (e: any) => err(e, 'Account action failed'),
  });
}

// ── Replenishments ───────────────────────────────────────────────────────────
export function useReplenishments(params?: any) {
  return useQuery({ queryKey: PQK.replenishments(params), queryFn: () => replenishmentsApi.list(params).then(r => r.data.data) });
}
export function useReplenishmentAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, id, payload }: { action: string; id?: string; payload?: any }) => {
      switch (action) {
        case 'create':  return replenishmentsApi.create(payload).then(r => r.data.data);
        case 'approve': return replenishmentsApi.approve(id!, payload).then(r => r.data.data);
        case 'decline': return replenishmentsApi.decline(id!, payload?.notes).then(r => r.data.data);
        case 'fund':    return replenishmentsApi.fund(id!).then(r => r.data.data);
        default: throw new Error('Unknown action');
      }
    },
    onSuccess: (_d, v) => { invalidatePayments(qc); qc.invalidateQueries({ queryKey: PQK.payDashboard }); toast.success(`Replenishment ${v.action === 'create' ? 'requested' : v.action + 'd'}`); },
    onError: (e: any) => err(e, 'Replenishment action failed'),
  });
}

// ── Payment requests ─────────────────────────────────────────────────────────
export function usePayments(params?: any) {
  return useQuery({ queryKey: PQK.payments(params), queryFn: () => paymentsApi.list(params).then(r => r.data.data) });
}
export function usePayment(id: string | null) {
  return useQuery({ queryKey: PQK.payment(id ?? ''), queryFn: () => paymentsApi.get(id!).then(r => r.data.data), enabled: !!id });
}
export function usePaymentDashboard() {
  return useQuery({ queryKey: PQK.payDashboard, queryFn: () => paymentsApi.dashboard().then(r => r.data.data), refetchInterval: 60_000 });
}
export function usePaymentExceptions(status?: string) {
  return useQuery({ queryKey: PQK.exceptions(status), queryFn: () => paymentsApi.exceptions(status).then(r => r.data.data) });
}
export function usePaymentAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, id, payload }: { action: string; id?: string; payload?: any }) => {
      switch (action) {
        case 'create':  return paymentsApi.create(payload).then(r => r.data.data);
        case 'submit':  return paymentsApi.submit(id!).then(r => r.data.data);
        case 'approve': return paymentsApi.approve(id!, payload?.comments).then(r => r.data.data);
        case 'process': return paymentsApi.process(id!, payload).then(r => r.data.data);
        case 'confirm': return paymentsApi.confirm(id!, payload.confirmationReference).then(r => r.data.data);
        case 'fail':    return paymentsApi.fail(id!, payload?.reason).then(r => r.data.data);
        case 'cancel':  return paymentsApi.cancel(id!).then(r => r.data.data);
        case 'resolveException': return paymentsApi.resolveException(id!).then(r => r.data.data);
        default: throw new Error('Unknown action');
      }
    },
    onSuccess: (_d, v) => {
      invalidatePayments(qc);
      qc.invalidateQueries({ queryKey: PQK.payDashboard });
      if (v.id) qc.invalidateQueries({ queryKey: PQK.payment(v.id) });
      const labels: Record<string, string> = {
        create: 'Payment request created', submit: 'Submitted for approval', approve: 'Payment approved',
        process: 'Payment disbursed', confirm: 'Payment confirmed', fail: 'Payment marked failed',
        cancel: 'Payment cancelled', resolveException: 'Exception resolved',
      };
      toast.success(labels[v.action] ?? 'Done');
    },
    onError: (e: any) => err(e, 'Payment action failed'),
  });
}
