import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";

// Admin email
export const ALLOWED_EMAIL = "albakaly779@gmail.com";
export const OWNER_PHONE = "+967779673273";
export const OWNER_NAME = "رداء";

export type UserRole =
  | "admin"          // Super Admin / Owner
  | "operations"     // Operations Manager
  | "accountant"     // Accountant
  | "branch_manager" // Branch Manager
  | "rep"            // Sales Representative
  | "marketer"       // Marketing
  | "support"        // Support
  | "partner";       // Partner (read-only dashboard)

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  role?: UserRole;
  mustChangePassword?: boolean;
  lastPasswordChange?: string;
}

// Maps stored DB role strings → UI UserRole
const DB_TO_UI_ROLE: Record<string, UserRole> = {
  super_admin: "admin",
  admin: "admin",
  owner: "admin",
  operations_manager: "operations",
  operations: "operations",
  accountant: "accountant",
  branch_manager: "branch_manager",
  rep: "rep",
  sales_rep: "rep",
  marketer: "marketer",
  marketing: "marketer",
  support: "support",
  partner: "partner",
};

export function normalizeRole(dbRole: string): UserRole {
  return DB_TO_UI_ROLE[dbRole] || "support";
}

export function mapSupabaseUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email!,
    username: user.user_metadata?.username || user.user_metadata?.full_name || user.email!.split("@")[0],
    avatar: user.user_metadata?.avatar_url,
    role: user.email === ALLOWED_EMAIL ? "admin" : undefined,
    mustChangePassword: user.user_metadata?.must_change_password === true,
    lastPasswordChange: user.user_metadata?.password_last_changed,
  };
}

export async function detectUserRole(email: string): Promise<UserRole> {
  if (email === ALLOWED_EMAIL) return "admin";

  // 1. Check partners_config for partner role (self-readable via RLS)
  const { data: partnerData } = await supabase
    .from("partners_config")
    .select("id")
    .eq("partner_email", email)
    .eq("is_active", true)
    .limit(1);
  if (partnerData && partnerData.length > 0) return "partner";

  // 2. Check user_roles for assigned role (self-readable via RLS)
  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("assigned_user_email", email)
    .eq("is_active", true)
    .limit(1);
  if (rolesData && rolesData.length > 0) {
    return normalizeRole(rolesData[0].role);
  }

  // 3. Check sales_reps table (self-readable via RLS)
  const { data: repData } = await supabase
    .from("sales_reps")
    .select("id")
    .eq("email", email)
    .eq("is_active", true)
    .limit(1);
  if (repData && repData.length > 0) return "rep";

  // Default: support (lowest permission)
  return "support";
}

export async function sendOtp(email: string) {
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
  console.log(`[NOTIFY ADMIN] المندوب ${repName} أضاف عميل جديد: ${customerName} (${customerPhone}) من ${source}`);
}
