import type { ModulePermission } from "@/lib/auth/types"
import { can } from "@/lib/auth/permissions"

/** Icon keys resolved to components in the client nav (icons can't cross the RSC boundary). */
export type NavIcon =
  | "dashboard"
  | "inventory"
  | "catalog"
  | "buildings"
  | "marina"
  | "messaging"
  | "rules"
  | "reports"
  | "customers"
  | "roles"
  | "system"

export interface NavItem {
  href: string
  label: string
  icon: NavIcon
  /** Module code gate. `null` = always visible to an authenticated user. */
  module: string | null
  /** Also visible to the Customer role even without a permission row. */
  allowCustomer?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: "dashboard", module: null },
  { href: "/app/inventory", label: "Inventory", icon: "inventory", module: "inventory", allowCustomer: true },
  { href: "/app/devices", label: "Devices", icon: "inventory", module: "inventory", allowCustomer: true },
  { href: "/app/catalog", label: "Catalog", icon: "catalog", module: "catalog" },
  { href: "/app/buildings", label: "Buildings", icon: "buildings", module: "buildings" },
  { href: "/app/marina", label: "Marina", icon: "marina", module: "marina", allowCustomer: true },
  { href: "/app/messaging", label: "Messaging", icon: "messaging", module: "messaging" },
  { href: "/app/rules", label: "Rule builder", icon: "rules", module: "rulebuilder" },
  { href: "/app/reports", label: "Reports", icon: "reports", module: "dashboard" },
  { href: "/app/customers", label: "Customers", icon: "customers", module: "commerce" },
  { href: "/app/roles", label: "Roles & access", icon: "roles", module: "roles_permissions" },
  { href: "/app/system", label: "System", icon: "system", module: "systems" },
]

export function visibleNavItems(
  permissions: ModulePermission[],
  opts: { isSuperAdmin: boolean; isCustomer: boolean },
): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (item.module === null) return true
    if (opts.isSuperAdmin) return true
    if (opts.isCustomer) return !!item.allowCustomer
    return can(permissions, item.module, "read")
  })
}
