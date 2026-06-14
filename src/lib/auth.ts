import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";

// Admin email
export const ALLOWED_EMAIL = "albakaly779@gmail.com";
export const OWNER_PHONE = "+967779673273";
export const OWNER_NAME = "رداء";

export type UserRole = "admin" | "rep" | "support" | "operations";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  role?: UserRole;
}

export function mapSupabaseUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email!,
    username: user.user_metadata?.username || user.user_metadata?.full_name || user.email!.split("@")[0],
    avatar: user.user_metadata?.avatar_url,
    role: user.email === ALLOWED_EMAIL ? "admin" : undefined,
  };
}

export async function detectUserRole(email: string): Promise<UserRole> {
  if (email === ALLOWED_EMAIL) return "admin";
  
  // Check user_roles table for assigned role
  const { data } = await supabase.from("user_roles")
    .select("role")
    .eq("assigned_user_email", email)
    .eq("is_active", true)
    .limit(1);
  
  if (data && data.length > 0) {
    const role = data[0].role;
    if (role === "super_admin" || role === "operations_manager" || role === "support") {
      const roleMap: Record<string, UserRole> = {
        super_admin: "admin",
        operations_manager: "operations",
        support: "support",
      };
      return roleMap[role] || "rep";
    }
    return role as UserRole;
  }

  // Check if email is a sales rep
  const { data: repData } = await supabase.from("sales_reps")
    .select("id")
    .eq("email", email)
    .eq("is_active", true)
    .limit(1);
  
  if (repData && repData.length > 0) return "rep";
  
  return "support"; // Default to lowest permission
}

export async function sendOtp(email: string) {
  // Allow admin and any registered rep/role
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function verifyOtpAndSetPassword(email: string, token: string, password: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) throw error;

  const isAdmin = email === ALLOWED_EMAIL;
  const { data: updateData, error: updateError } = await supabase.auth.updateUser({
    password,
    data: {
      username: isAdmin ? OWNER_NAME : email.split("@")[0],
      phone: isAdmin ? OWNER_PHONE : "",
    },
  });
  if (updateError) throw updateError;

  return updateData.user;
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Send email notification to admin when rep adds a customer
export async function notifyAdminNewCustomer(repName: string, customerName: string, customerPhone: string, source: string) {
  // Use Supabase edge function or direct email - for now log and use notification store
  console.log(`[NOTIFY ADMIN] المندوب ${repName} أضاف عميل جديد: ${customerName} (${customerPhone}) من ${source}`);
}
