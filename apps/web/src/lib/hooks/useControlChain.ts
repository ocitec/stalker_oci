import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { salesApi, creditApi, transactionsApi } from '@/lib/api/client';

// ── Query keys ───────────────────────────────────────────────────────────────
export const CQK = {
  sales:          (p?: any) => ['sales-requests', p],
  sale:           (id: string) => ['sales-requests', id],
  credit:         (p?: any) => ['credit-requests', p],
  creditOne:      (id: string) => ['credit-requests', id],
  transactions:   (p?: any) => ['transactions', p],
  transaction:    (id: string) => ['transactions', id],
  txnDashboard:   ['transactions', 'dashboard'],
};

const err = (e: any, fallback: string) => toast.error(e.response?.data?.message || fallback);

/** Invalidate every query that a chain mutation can affect. */
function invalidateChain(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['sales-requests'] });
  qc.invalidateQueries({ queryKey: ['credit-requests'] });
  qc.invalidateQueries({ queryKey: ['transactions'] });
}

// ── Sales requests ───────────────────────────────────────────────────────────
export function useSalesRequests(params?: any) {
  return useQuery({ queryKey: CQK.sales(params), queryFn: () => salesApi.list(params).then(r => r.data.data) });
}
export function useSalesRequest(id: string | null) {
  return useQuery({ queryKey: CQK.sale(id ?? ''), queryFn: () => salesApi.get(id!).then(r => r.data.data), enabled: !!id });
}
export function useSalesAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, id, payload }: { action: string; id?: string; payload?: any }) => {
      switch (action) {
        case 'create':  return salesApi.create(payload).then(r => r.data.data);
        case 'submit':  return salesApi.submit(id!).then(r => r.data.data);
        case 'approve': return salesApi.approve(id!).then(r => r.data.data);
        case 'reject':  return salesApi.reject(id!, payload?.comments).then(r => r.data.data);
        case 'cancel':  return salesApi.cancel(id!).then(r => r.data.data);
        default: throw new Error('Unknown action');
      }
    },
    onSuccess: (_d, v) => {
      invalidateChain(qc);
      toast.success(`Sales request ${v.action === 'create' ? 'created' : v.action + 'd'}`);
    },
    onError: (e: any) => err(e, 'Sales request action failed'),
  });
}

// ── Credit requests ──────────────────────────────────────────────────────────
export function useCreditRequests(params?: any) {
  return useQuery({ queryKey: CQK.credit(params), queryFn: () => creditApi.list(params).then(r => r.data.data) });
}
export function useCreditRequest(id: string | null) {
  return useQuery({ queryKey: CQK.creditOne(id ?? ''), queryFn: () => creditApi.get(id!).then(r => r.data.data), enabled: !!id });
}
export function useCreditAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, id, payload }: { action: string; id?: string; payload?: any }) => {
      switch (action) {
        case 'create':  return creditApi.create(payload).then(r => r.data.data);
        case 'approve': return creditApi.approve(id!, payload).then(r => r.data.data);
        case 'decline': return creditApi.decline(id!, payload?.comments).then(r => r.data.data);
        case 'hold':    return creditApi.hold(id!, payload?.comments).then(r => r.data.data);
        default: throw new Error('Unknown action');
      }
    },
    onSuccess: (_d, v) => {
      invalidateChain(qc);
      toast.success(`Credit request ${v.action === 'create' ? 'created' : v.action + 'd'}`);
    },
    onError: (e: any) => err(e, 'Credit request action failed'),
  });
}

// ── Transactions ─────────────────────────────────────────────────────────────
export function useTransactions(params?: any) {
  return useQuery({ queryKey: CQK.transactions(params), queryFn: () => transactionsApi.list(params).then(r => r.data.data) });
}
export function useTransaction(id: string | null) {
  return useQuery({ queryKey: CQK.transaction(id ?? ''), queryFn: () => transactionsApi.get(id!).then(r => r.data.data), enabled: !!id });
}
export function useTransactionDashboard() {
  return useQuery({
    queryKey: CQK.txnDashboard,
    queryFn:  () => transactionsApi.dashboard().then(r => r.data.data),
    refetchInterval: 60_000,
  });
}
export function useTransactionAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, id, payload }: { action: string; id?: string; payload?: any }) => {
      switch (action) {
        case 'create':        return transactionsApi.create(payload).then(r => r.data.data);
        case 'update':        return transactionsApi.update(id!, payload).then(r => r.data.data);
        case 'submit':        return transactionsApi.submit(id!).then(r => r.data.data);
        case 'approve':       return transactionsApi.approve(id!, payload?.comments).then(r => r.data.data);
        case 'decline':       return transactionsApi.decline(id!, payload?.comments).then(r => r.data.data);
        case 'hold':          return transactionsApi.hold(id!, payload?.comments).then(r => r.data.data);
        case 'resume':        return transactionsApi.resume(id!).then(r => r.data.data);
        case 'cancel':        return transactionsApi.cancel(id!).then(r => r.data.data);
        case 'verifyPayment': return transactionsApi.verifyPayment(id!, payload).then(r => r.data.data);
        case 'fulfilment':    return transactionsApi.fulfilment(id!, payload.fulfilmentStatus).then(r => r.data.data);
        default: throw new Error('Unknown action');
      }
    },
    onSuccess: (_d, v) => {
      invalidateChain(qc);
      qc.invalidateQueries({ queryKey: CQK.txnDashboard });
      if (v.id) qc.invalidateQueries({ queryKey: CQK.transaction(v.id) });
      const labels: Record<string, string> = {
        create: 'Transaction created', submit: 'Submitted for review', approve: 'Approval recorded',
        decline: 'Transaction declined', hold: 'Transaction held', resume: 'Returned to review',
        cancel: 'Transaction cancelled', verifyPayment: 'Payment verification saved',
        fulfilment: 'Fulfilment updated', update: 'Transaction updated',
      };
      toast.success(labels[v.action] ?? 'Done');
    },
    onError: (e: any) => err(e, 'Transaction action failed'),
  });
}
