// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { create } from "zustand";
import { getApiBaseUrl } from "../lib/api";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  token: string | null;
  /** True until initial session check finishes */
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  loadUser: () => Promise<void>;
  /** Update cached user (e.g. after profile save). */
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  login: (token, user) => {
    localStorage.setItem("miqraa_token", token);
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem("miqraa_token");
    set({ token: null, user: null });
  },
  setUser: (user) => set({ user }),
  loadUser: async () => {
    const token = localStorage.getItem("miqraa_token");
    if (!token) {
      set({ user: null, token: null, isLoading: false });
      return;
    }
    const tokenForThisRequest = token;
    set({ token, isLoading: true });
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/me`, {
        headers: { Authorization: `Bearer ${tokenForThisRequest}` },
      });
      if (!res.ok) {
        throw new Error("unauthorized");
      }
      const data = (await res.json()) as User;
      // Ignore stale responses if login() replaced the token while this fetch was in flight
      if (localStorage.getItem("miqraa_token") !== tokenForThisRequest) {
        set({ isLoading: false });
        return;
      }
      set({ user: data, isLoading: false });
    } catch {
      // Do not wipe a successful login that happened while this request was in flight
      if (localStorage.getItem("miqraa_token") !== tokenForThisRequest) {
        set({ isLoading: false });
        return;
      }
      localStorage.removeItem("miqraa_token");
      set({ user: null, token: null, isLoading: false });
    }
  },
}));

export function selectIsAuthenticated(state: AuthState): boolean {
  return !!(state.user && state.token);
}
