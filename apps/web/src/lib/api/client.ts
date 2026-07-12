import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/lib/store/auth.store';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// ── Axios instance ─────────────────────────────────────────────────────────
export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// ── Request interceptor — attach access token ─────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor — silent token refresh ───────────────────────────
let isRefreshing      = false;
let pendingQueue: Array<{ resolve: (v: string) => void; reject: (e: any) => void }> = [];

function processQueue(error: any, token: string | null = null) {
  pendingQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token!)));
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original: AxiosRequestConfig & { _retry?: boolean } = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing    = true;

    const { refreshToken, updateToken, clearAuth } = useAuthStore.getState();

    if (!refreshToken) {
      clearAuth();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    try {
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
      const { accessToken: newAccess, refreshToken: newRefresh } = data.data;
      updateToken(newAccess, newRefresh);
      processQueue(null, newAccess);
      original.headers = { ...original.headers, Authorization: `Bearer ${newAccess}` };
      return api(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearAuth();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// API domain helpers
// ─────────────────────────────────────────────────────────────────────────────

export const authApi = {
  login:          (credentials: { email: string; password: string }) =>
    api.post('/auth/login', credentials),
  register:       (data: any) => api.post('/auth/register', data),
  refresh:        (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
  logout:         (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  me:             () => api.get('/auth/me'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword:  (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),
};

export const profileApi = {
  get:            ()                                                 => api.get('/users/me/profile'),
  update:         (data: { name?: string; email?: string })        => api.patch('/users/me/profile', data),
  changePassword: (currentPassword: string, newPassword: string)   =>
    api.patch('/users/me/password', { currentPassword, newPassword }),
  activity:       (page = 1, limit = 20)                           =>
    api.get('/users/me/activity', { params: { page, limit } }),
};

export const reportsApi = {
  invoices:    (params?: any) => api.get('/reports/invoices',    { params }),
  collections: (params?: any) => api.get('/reports/collections', { params }),
  clients:     (params?: any) => api.get('/reports/clients',     { params }),
  exportUrl:   (type: string, params?: any) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/reports/${type}/export${qs}`;
  },
};

export const clientsApi = {
  list:       (params?: any)                   => api.get('/clients', { params }),
  get:        (id: string)                     => api.get(`/clients/${id}`),
  create:     (data: any)                      => api.post('/clients', data),
  update:     (id: string, data: any)          => api.put(`/clients/${id}`, data),
  block:      (id: string, reason: string)     => api.patch(`/clients/${id}/block`, { reason }),
  unblock:    (id: string)                     => api.patch(`/clients/${id}/unblock`),
  pdiRanking: ()                               => api.get('/clients/pdi-ranking'),
};

export const invoicesApi = {
  list:    (params?: any) => api.get('/invoices', { params }),
  get:     (id: string)   => api.get(`/invoices/${id}`),
  overdue: ()             => api.get('/invoices/overdue'),
  aging:   ()             => api.get('/invoices/aging'),
  dso:     ()             => api.get('/invoices/dso'),
  create:  (data: any)    => api.post('/invoices', data),
  update:  (id: string, data: any) => api.patch(`/invoices/${id}`, data),

  // ── Mark paid: supports full or partial payment ──────────────────────────
  markPaid: (
    id: string,
    data?: {
      paymentAmount?: number;   // omit for full payment
      paymentDate?:  string;
      notes?:        string;
    },
  ) => api.patch(`/invoices/${id}/mark-paid`, data ?? {}),

  // ── Revert the most recent payment on an invoice ─────────────────────────
  revertPayment: (
    id: string,
    paymentRecordId: string,
    reason?: string,
  ) => api.patch(`/invoices/${id}/revert-payment`, { paymentRecordId, reason }),
};

export const followUpsApi = {
  list:       (params?: any) => api.get('/followups', { params }),
  create:     (data: any)    => api.post('/followups', data),
  compliance: ()             => api.get('/followups/compliance'),
};

export const alertsApi = {
  list:        (params?: any) => api.get('/alerts', { params }),
  unreadCount: ()             => api.get('/alerts/unread-count'),
  markRead:    (id: string)   => api.patch(`/alerts/${id}/read`),
  markAllRead: ()             => api.patch('/alerts/mark-all-read'),
};

export const analyticsApi = {
  insights:       () => api.get('/analytics/insights'),
  predictiveRisk: () => api.get('/analytics/predictive-risk'),
  sector:         () => api.get('/analytics/sector'),
  dsoTrend:       () => api.get('/analytics/dso-trend'),
  cfoReport:      () => api.get('/analytics/cfo-report'),
};

export const slaApi = {
  violations:  (params?: any) => api.get('/sla/violations', { params }),
  topViolators:()             => api.get('/sla/top-violators'),
  summary:     ()             => api.get('/sla/summary'),
};

export const dashboardApi = {
  get: () => api.get('/dashboard'),
};