import type { UserRole } from "@/lib/auth";

export type Permission =
  | "dashboard.view"
  | "orders.view"
  | "customers.view"
  | "products.view"
  | "production.view"
  | "production.create"
  | "production.review"
  | "finance.view"
  | "finance.export"
  | "returns.create"
  | "returns.review"
  | "returns.execute"
  | "partner.dashboard"
  | "partner.sign"
  | "users.manage"
  | "audit.view"
  | "settings.manage";

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  admin: [
    "dashboard.view", "orders.view", "customers.view", "products.view",
    "production.view", "production.create", "production.review", "finance.view",
    "finance.export", "returns.create", "returns.review", "returns.execute",
    "partner.dashboard", "partner.sign", "users.manage", "audit.view", "settings.manage",
  ],
  operations: [
    "dashboard.view", "orders.view", "customers.view", "products.view",
    "production.view", "production.create", "production.review",
    "returns.create", "returns.review",
  ],
  accountant: ["dashboard.view", "customers.view", "finance.view", "finance.export", "returns.review"],
  branch_manager: [
    "dashboard.view", "orders.view", "customers.view", "products.view",
    "production.view", "production.create", "returns.create", "returns.review",
  ],
  rep: ["dashboard.view", "orders.view", "customers.view", "returns.create"],
  marketer: ["dashboard.view", "customers.view"],
  support: ["dashboard.view", "customers.view", "orders.view"],
  partner: ["partner.dashboard", "partner.sign"],
};

export function hasPermission(role: UserRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: UserRole | undefined): readonly Permission[] {
  return role ? ROLE_PERMISSIONS[role] ?? [] : [];
}
