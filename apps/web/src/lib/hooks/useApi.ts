import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  dashboardApi, clientsApi, invoicesApi,
  followUpsApi, alertsApi, analyticsApi, slaApi,
} from '@/lib/api/client';

// ── Query keys ─────────────────────────────────────────────────────────────
export const QK = {
  dashboard:       ['dashboard'],
  clients:         (p?: any) => ['clients', p],
  client:          (id: string) => ['clients', id],
  pdiRanking:      ['pdi-ranking'],
  invoices:        (p?: any) => ['invoices', p],
  invoice:         (id: string) => ['invoices', id],
  overdueInvoices: ['invoices', 'overdue'],
  aging:           ['invoices', 'aging'],
  followUps:       (p?: any) => ['followups', p],
  compliance:      ['followups', 'compliance'],
  alerts:          (p?: any) => ['alerts', p],
  unreadCount:     ['alerts', 'unread'],
  slaViolations:   (p?: any) => ['sla', p],
  slaSummary:      ['sla', 'summary'],
  topViolators:    ['sla', 'top-violators'],
  insights:        ['analytics', 'insights'],
  predictiveRisk:  ['analytics', 'predictive-risk'],
  sectorAnalysis:  ['analytics', 'sector'],
  dsoTrend:        ['analytics', 'dso-trend'],
  cfoReport:       ['analytics', 'cfo-report'],
};

// Helper to invalidate everything payment-related at once
function invalidatePaymentQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['invoices'] });
  qc.invalidateQueries({ queryKey: ['clients'] });
  qc.invalidateQueries({ queryKey: QK.dashboard });
  qc.invalidateQueries({ queryKey: QK.overdueInvoices });
  qc.invalidateQueries({ queryKey: QK.aging });
}

// ── Dashboard ──────────────────────────────────────────────────────────────
export function useDashboard() {
  return useQuery({
    queryKey: QK.dashboard,
    queryFn:  () => dashboardApi.get().then(r => r.data.data),
    refetchInterval: 60_000,
  });
}

// ── Clients ────────────────────────────────────────────────────────────────
export function useClients(params?: any) {
  return useQuery({
    queryKey: QK.clients(params),
    queryFn:  () => clientsApi.list(params).then(r => r.data.data),
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: QK.client(id),
    queryFn:  () => clientsApi.get(id).then(r => r.data.data),
    enabled:  !!id,
  });
}

export function usePdiRanking() {
  return useQuery({
    queryKey: QK.pdiRanking,
    queryFn:  () => clientsApi.pdiRanking().then(r => r.data.data),
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => clientsApi.create(data).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: QK.dashboard });
      toast.success('Client created successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to create client'),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      clientsApi.update(id, data).then(r => r.data.data),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: QK.client(id) });
      toast.success('Client updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to update client'),
  });
}

export function useBlockClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      clientsApi.block(id, reason).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client blocked');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to block client'),
  });
}

export function useUnblockClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      clientsApi.unblock(id).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client unblocked');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to unblock client'),
  });
}

// ── Invoices ───────────────────────────────────────────────────────────────
export function useInvoices(params?: any) {
  return useQuery({
    queryKey: QK.invoices(params),
    queryFn:  () => invoicesApi.list(params).then(r => r.data.data),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: QK.invoice(id),
    queryFn:  () => invoicesApi.get(id).then(r => r.data.data),
    enabled:  !!id,
  });
}

export function useOverdueInvoices() {
  return useQuery({
    queryKey: QK.overdueInvoices,
    queryFn:  () => invoicesApi.overdue().then(r => r.data.data),
    refetchInterval: 30_000,
  });
}

export function useAgingReport() {
  return useQuery({
    queryKey: QK.aging,
    queryFn:  () => invoicesApi.aging().then(r => r.data.data),
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => invoicesApi.create(data).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: QK.dashboard });
      toast.success('Invoice created successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to create invoice'),
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      invoicesApi.update(id, data).then(r => r.data.data),
    onSuccess: (updated: any) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: QK.dashboard });
      if (updated?.id) {
        qc.invalidateQueries({ queryKey: QK.invoice(updated.id) });
      }
      toast.success('Invoice updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to update invoice'),
  });
}

// ── Mark paid — supports full and partial payments ─────────────────────────
export function useMarkPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      paymentAmount,
      paymentDate,
      notes,
    }: {
      id:             string;
      paymentAmount?: number;    // omit for full payment
      paymentDate?:   string;
      notes?:         string;
    }) =>
      invoicesApi
        .markPaid(id, { paymentAmount, paymentDate, notes })
        .then(r => r.data.data),

    onSuccess: (data: any) => {
      invalidatePaymentQueries(qc);
      // Re-fetch the specific invoice so the drawer updates immediately
      if (data?.invoice?.id) {
        qc.invalidateQueries({ queryKey: QK.invoice(data.invoice.id) });
      }
      if (data?.isFullyPaid) {
        toast.success('Invoice paid in full — PDI updated');
      } else {
        toast.success('Partial payment recorded');
      }
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.message || 'Failed to record payment'),
  });
}

// ── Revert payment ─────────────────────────────────────────────────────────
export function useRevertPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      invoiceId,
      paymentRecordId,
      reason,
    }: {
      invoiceId:       string;
      paymentRecordId: string;
      reason?:         string;
    }) =>
      invoicesApi
        .revertPayment(invoiceId, paymentRecordId, reason)
        .then(r => r.data.data),

    onSuccess: (data: any) => {
      invalidatePaymentQueries(qc);
      if (data?.invoice?.id) {
        qc.invalidateQueries({ queryKey: QK.invoice(data.invoice.id) });
      }
      toast.success(`Payment of ${data?.revertedAmount?.toLocaleString('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 })} reverted`);
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.message || 'Failed to revert payment'),
  });
}

// ── Follow-ups ─────────────────────────────────────────────────────────────
export function useFollowUps(params?: any) {
  return useQuery({
    queryKey: QK.followUps(params),
    queryFn:  () => followUpsApi.list(params).then(r => r.data.data),
  });
}

export function useFollowUpCompliance() {
  return useQuery({
    queryKey: QK.compliance,
    queryFn:  () => followUpsApi.compliance().then(r => r.data.data),
    refetchInterval: 60_000,
  });
}

export function useCreateFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => followUpsApi.create(data).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['followups'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Follow-up logged');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to log follow-up'),
  });
}

// ── Alerts ─────────────────────────────────────────────────────────────────
export function useAlerts(params?: any) {
  return useQuery({
    queryKey: QK.alerts(params),
    queryFn:  () => alertsApi.list(params).then(r => r.data.data),
    refetchInterval: 30_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: QK.unreadCount,
    queryFn:  () => alertsApi.unreadCount().then(r => r.data.data),
    refetchInterval: 15_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => alertsApi.markRead(id).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to mark read'),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => alertsApi.markAllRead().then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('All alerts marked as read');
    },
  });
}

// ── SLA ────────────────────────────────────────────────────────────────────
export function useSlaViolations(params?: any) {
  return useQuery({
    queryKey: QK.slaViolations(params),
    queryFn:  () => slaApi.violations(params).then(r => r.data.data),
  });
}

export function useSlaViolationsSummary() {
  return useQuery({
    queryKey: QK.slaSummary,
    queryFn:  () => slaApi.summary().then(r => r.data.data),
  });
}

export function useTopViolators() {
  return useQuery({
    queryKey: QK.topViolators,
    queryFn:  () => slaApi.topViolators().then(r => r.data.data),
  });
}

// ── Analytics ──────────────────────────────────────────────────────────────
export function useAiInsights() {
  return useQuery({
    queryKey: QK.insights,
    queryFn:  () => analyticsApi.insights().then(r => r.data.data),
    staleTime: 5 * 60_000,
  });
}

export function usePredictiveRisk() {
  return useQuery({
    queryKey: QK.predictiveRisk,
    queryFn:  () => analyticsApi.predictiveRisk().then(r => r.data.data),
  });
}

export function useSectorAnalysis() {
  return useQuery({
    queryKey: QK.sectorAnalysis,
    queryFn:  () => analyticsApi.sector().then(r => r.data.data),
  });
}

export function useDsoTrend() {
  return useQuery({
    queryKey: QK.dsoTrend,
    queryFn:  () => analyticsApi.dsoTrend().then(r => r.data.data),
    staleTime: 5 * 60_000,
  });
}

export function useCfoReport() {
  return useQuery({
    queryKey: QK.cfoReport,
    queryFn:  () => analyticsApi.cfoReport().then(r => r.data.data),
  });
}