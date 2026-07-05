import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { mapSupabaseUser, detectUserRole, ALLOWED_EMAIL } from "@/lib/auth";
import { logActivity } from "@/hooks/useActivityLogger";
import type { AuthUser, UserRole } from "@/lib/auth";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  role: UserRole;
  login: (user: AuthUser) => void;
  logout: () => Promise<void>;
  setRole: (role: UserRole) => void;
}

let globalUser: AuthUser | null = null;
let globalLoading = true;
let globalRole: UserRole = "admin";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function useAuth(): AuthState {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((c) => c + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (mounted && session?.user) {
        const mapped = mapSupabaseUser(session.user);
        const role = await detectUserRole(session.user.email!);
        mapped.role = role;
        globalUser = mapped;
        globalRole = role;
      }
      if (mounted) {
        globalLoading = false;
        notify();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (event === "SIGNED_IN" && session?.user) {
          const mapped = mapSupabaseUser(session.user);
          const role = await detectUserRole(session.user.email!);
          mapped.role = role;
          globalUser = mapped;
          globalRole = role;
          globalLoading = false;
          notify();
          // Log login activity (fire-and-forget)
          logActivity(mapped.email, mapped.id, "login", `تسجيل دخول (${role === "admin" ? "مدير عام" : role === "rep" ? "مندوب" : role})`, {
            details: `دخول ناجح من ${typeof window !== "undefined" ? window.location.origin : ""}`,
          }).catch(() => { /* silent */ });
        } else if (event === "SIGNED_OUT") {
          // Log logout before clearing state
          if (globalUser) {
            logActivity(globalUser.email, globalUser.id, "logout", "تسجيل خروج", {}).catch(() => { /* silent */ });
          }
          globalUser = null;
          globalRole = "admin";
          globalLoading = false;
          notify();
        } else if (event === "TOKEN_REFRESHED" && session?.user) {
          const mapped = mapSupabaseUser(session.user);
          mapped.role = globalRole;
          globalUser = mapped;
          notify();
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback((user: AuthUser) => {
    globalUser = user;
    globalLoading = false;
    notify();
  }, []);

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error(error);
    globalUser = null;
    globalRole = "admin";
    notify();
  }, []);

  const setRole = useCallback((role: UserRole) => {
    globalRole = role;
    if (globalUser) globalUser.role = role;
    notify();
  }, []);

  return {
    user: globalUser,
    loading: globalLoading,
    role: globalRole,
    login,
    logout,
    setRole,
  };
}
