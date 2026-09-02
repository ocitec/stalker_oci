import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { receiptsApi } from '@/lib/api/client';

export const RQK = {
  receipts:    (p?: any)        => ['receipts', p],
  receipt:     (id: string)     => ['receipts', id],
  outstanding: (clientId: string) => ['receipts', 'outstanding', clientId],
};

export function useReceipts(params?: any) {
  return useQuery({ queryKey: RQK.receipts(params), queryFn: () => receiptsApi.list(params).then(r => r.data.data) });
}

export function useReceipt(id: string | null) {
  return useQuery({ queryKey: RQK.receipt(id ?? ''), queryFn: () => receiptsApi.get(id!).then(r => r.data.data), enabled: !!id });
}

export function useReceiptOutstanding(clientId: string | null) {
  return useQuery({
    queryKey: RQK.outstanding(clientId ?? ''),
    queryFn:  () => receiptsApi.outstanding(clientId!).then(r => r.data.data),
    enabled:  !!clientId,
  });
}

/** Consolidate calculation (no persistence) — used for the review step. */
export function usePreviewReceipt() {
  return useMutation({
    mutationFn: (data: { clientId: string; amount: number }) => receiptsApi.preview(data).then(r => r.data.data),
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to calculate allocation'),
  });
}

export function useCreateReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => receiptsApi.create(data).then(r => r.data.data),
    onSuccess: (data: any) => {
      // Invoices, clients (PDI) and the dashboard all move when a receipt is applied.
      qc.invalidateQueries({ queryKey: ['receipts'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Receipt ${data?.reference ?? ''} recorded`);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to record receipt'),
  });
}
