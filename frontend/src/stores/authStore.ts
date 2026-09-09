import { create } from "zustand";
import { authApi, type AuthUser } from "@/lib/api";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  devLogin: () => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem("token"),
  isAuthenticated: !!localStorage.getItem("token"),
  isLoading: false,

  login: async (email, password) => {
    const res = await authApi.login({ email, password });
    localStorage.setItem("token", res.access_token);
    set({ user: res.user, token: res.access_token, isAuthenticated: true });
  },

  devLogin: async () => {
    const res = await authApi.devLogin();
    localStorage.setItem("token", res.access_token);
    set({ user: res.user, token: res.access_token, isAuthenticated: true });
  },

  register: async (email, name, password) => {
    const res = await authApi.register({ email, name, password });
    localStorage.setItem("token", res.access_token);
    set({ user: res.user, token: res.access_token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem("token");
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadUser: async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      set({ isAuthenticated: false });
      return;
    }
    set({ isLoading: true });
    try {
      const user = await authApi.me();
      set({ user, isAuthenticated: true });
    } catch {
      localStorage.removeItem("token");
      set({ user: null, token: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));
