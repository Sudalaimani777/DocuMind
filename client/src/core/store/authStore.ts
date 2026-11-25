import { create } from 'zustand';
import type { UserDTO } from '@documind/shared';
import { queryClient } from '../../app/providers';
import { getCurrentUser, signOut } from '../../features/auth/api/auth.api';
import { useSearchStore } from '../../features/search/store/searchStore';

interface AuthState {
  user: UserDTO | null;
  isAuthenticated: boolean;
  isCheckingAuth: boolean;
  hasCheckedAuth: boolean;
  setUser: (user: UserDTO | null) => void;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

let activeAuthCheck: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isCheckingAuth: false,
  hasCheckedAuth: false,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: Boolean(user),
      hasCheckedAuth: true,
    }),

  checkAuth: async () => {
    if (activeAuthCheck) {
      return activeAuthCheck;
    }
    if (get().hasCheckedAuth && get().isAuthenticated) {
      return;
    }

    set({ isCheckingAuth: true });
    activeAuthCheck = (async () => {
      try {
        const user = await getCurrentUser();
        set({
          user,
          isAuthenticated: true,
          isCheckingAuth: false,
          hasCheckedAuth: true,
        });
      } catch {
        set({
          user: null,
          isAuthenticated: false,
          isCheckingAuth: false,
          hasCheckedAuth: true,
        });
      } finally {
        activeAuthCheck = null;
      }
    })();

    return activeAuthCheck;
  },

  logout: async () => {
    try {
      await signOut();
    } finally {
      queryClient.clear();
      useSearchStore.setState({
        query: '',
        mode: 'hybrid',
        format: undefined,
        startDate: '',
        endDate: '',
        documentId: undefined,
        selectedResult: null,
        isCommandPaletteOpen: false,
      });
      set({
        user: null,
        isAuthenticated: false,
        hasCheckedAuth: true,
      });
    }
  },
}));
