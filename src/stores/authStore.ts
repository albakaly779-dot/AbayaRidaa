import { create } from "zustand";

// Auth store is now replaced by useAuth hook
// This file kept for backward compatibility - redirects to useAuth
interface AuthState {
  isAuthenticated: boolean;
  user: { id: string; name: string; email: string; role: string } | null;
}

export const useAuthStore = create<AuthState>()(() => ({
  isAuthenticated: false,
  user: null,
}));
