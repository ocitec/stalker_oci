import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'CFO' | 'FINANCE' | 'SALES';
  organization: { id: string; name: string; industry?: string };
}

interface AuthState {
  user:            User | null;
  accessToken:     string | null;
  refreshToken:    string | null;
  isAuthenticated: boolean;
  // ── Hydration flag ──────────────────────────────────────────────────────────
  // Zustand's persist middleware reads localStorage asynchronously after the
  // first render. This flag turns true once that read is complete. Any
  // component that makes routing decisions based on auth state MUST wait for
  // this to be true before acting — otherwise it reads the default (logged-out)
  // state and wrongly redirects an authenticated user to /login on every reload.
  _hasHydrated:    boolean;

  setAuth:         (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth:       () => void;
  updateToken:     (accessToken: string, refreshToken: string) => void;
  setHasHydrated:  (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:            null,
      accessToken:     null,
      refreshToken:    null,
      isAuthenticated: false,
      _hasHydrated:    false,

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),

      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),

      updateToken: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      setHasHydrated: (value) =>
        set({ _hasHydrated: value }),
    }),
    {
      name:    'stalker-auth',
      storage: createJSONStorage(() => localStorage),

      // Only persist the auth payload — never persist _hasHydrated itself.
      // It must always start as false and only become true after localStorage
      // is read, so the layout knows when it is safe to check auth state.
      partialize: (state) => ({
        user:            state.user,
        accessToken:     state.accessToken,
        refreshToken:    state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),

      // Called once localStorage has been fully read back and the store
      // has been updated with the persisted values.
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);