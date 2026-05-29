import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface RetryAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
}

// ─────────────────────────────────────────────
// Safe Storage Helpers (SSR-safe)
// ─────────────────────────────────────────────
const STORAGE_KEY = 'stalker-auth';

function isBrowser() {
  return typeof window !== 'undefined';
}

function getAuth(): AuthState {
  if (!isBrowser()) return { accessToken: null, refreshToken: null };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { accessToken: null, refreshToken: null };

    const parsed = JSON.parse(raw);
    return {
      accessToken: parsed?.state?.accessToken ?? null,
      refreshToken: parsed?.state?.refreshToken ?? null,
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return { accessToken: null, refreshToken: null };
  }
}

function setAuth(accessToken: string, refreshToken: string) {
  if (!isBrowser()) return;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    parsed.state.accessToken = accessToken;
    parsed.state.refreshToken = refreshToken;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function clearAuth() {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEY);
}

// ─────────────────────────────────────────────
// Axios Instance
// ─────────────────────────────────────────────
export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ─────────────────────────────────────────────
// Refresh Control (Race-condition safe)
// ─────────────────────────────────────────────
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const { refreshToken } = getAuth();

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await axios.post(
      `${BASE_URL}/auth/refresh`,
      null,
      {
        headers: { 'X-Refresh-Token': refreshToken },
      }
    );

    const { accessToken, refreshToken: newRefresh } = response.data.data;

    setAuth(accessToken, newRefresh);

    return accessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

// ─────────────────────────────────────────────
// Request Interceptor
// ─────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const { accessToken } = getAuth();

  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

// ─────────────────────────────────────────────
// Response Interceptor
// ─────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryAxiosRequestConfig;

    if (!original) {
      return Promise.reject(error);
    }

    const status = error.response?.status;

    // Only handle 401
    if (status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      const newAccessToken = await refreshAccessToken();

      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${newAccessToken}`;

      return api(original);
    } catch (refreshError) {
      clearAuth();

      if (isBrowser() && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }

      return Promise.reject(refreshError);
    }
  }
);

// ─────────────────────────────────────────────
// API Modules (unchanged, but cleaner types optional)
// ─────────────────────────────────────────────
export const authApi = {
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),

  register: (data: any) =>
    api.post('/auth/register', data),

  refresh: (token: string) =>
    api.post('/auth/refresh', null, {
      headers: { 'X-Refresh-Token': token },
    }),

  logout: (token: string) =>
    api.post('/auth/logout', null, {
      headers: { 'X-Refresh-Token': token },
    }),

  me: () => api.get('/auth/me'),
};

export const dashboardApi = {
  get: () => api.get('/dashboard'),
};

export const clientsApi = {
  list:     (params?: any) => api.get('/clients', { params }),
  get:      (id: string)   => api.get(`/clients/${id}`),
  create:   (data: any)    => api.post('/clients', data),
  update:   (id: string, data: any) => api.put(`/clients/${id}`, data),
  block:    (id: string, reason: string) => api.patch(`/clients/${id}/block`, { reason }),
  unblock:  (id: string)   => api.patch(`/clients/${id}/unblock`),
  pdiRanking: () => api.get('/clients/pdi-ranking'),
};

export const invoicesApi = {
  list:      (params?: any) => api.get('/invoices', { params }),
  get:       (id: string)   => api.get(`/invoices/${id}`),
  create:    (data: any)    => api.post('/invoices', data),
  overdue:   ()             => api.get('/invoices/overdue'),
  aging:     ()             => api.get('/invoices/aging'),
  dso:       ()             => api.get('/invoices/dso'),
  markPaid:  (id: string, data?: any) => api.patch(`/invoices/${id}/mark-paid`, data),
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
  pdiRanking:     () => api.get('/analytics/pdi-ranking'),
  sector:         () => api.get('/analytics/sector'),
  dsoTrend:       () => api.get('/analytics/dso-trend'),
  predictiveRisk: () => api.get('/analytics/predictive-risk'),
  insights:       () => api.get('/analytics/insights'),
  cfoReport:      () => api.get('/analytics/cfo-report'),
};

export const slaApi = {
  violations:   (params?: any) => api.get('/sla/violations', { params }),
  topViolators: ()             => api.get('/sla/top-violators'),
  summary:      ()             => api.get('/sla/summary'),
};
