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

/** Sidebar group — mirrors the reference's grouped-nav pattern (eyebrow group label above each section). */
export type NavGroup = "Overview" | "Fleet" | "Sites" | "Commerce" | "Automation" | "Admin"

export interface NavItem {
  href: string
  label: string
  icon: NavIcon
  group: NavGroup
  /** Module code gate. `null` = always visible to an authenticated user. */
  module: string | null
  /** Also visible to the Customer role even without a permission row. */
  allowCustomer?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: "dashboard", group: "Overview", module: null },
  { href: "/app/reports", label: "Reports", icon: "reports", group: "Overview", module: "dashboard" },
  { href: "/app/devices", label: "Devices", icon: "inventory", group: "Fleet", module: "inventory", allowCustomer: true },
  { href: "/app/inventory", label: "Inventory", icon: "inventory", group: "Fleet", module: "inventory", allowCustomer: true },
  { href: "/app/catalog", label: "Catalog", icon: "catalog", group: "Fleet", module: "catalog" },
  { href: "/app/buildings", label: "Buildings", icon: "buildings", group: "Sites", module: "buildings" },
  { href: "/app/marina", label: "Marina", icon: "marina", group: "Sites", module: "marina", allowCustomer: true },
  { href: "/app/customers", label: "Customers", icon: "customers", group: "Commerce", module: "commerce" },
  { href: "/app/billing", label: "Billing", icon: "reports", group: "Commerce", module: "commerce" },
  { href: "/app/messaging", label: "Messaging", icon: "messaging", group: "Automation", module: "messaging" },
  { href: "/app/rules", label: "Rule builder", icon: "rules", group: "Automation", module: "rulebuilder" },
  { href: "/app/roles", label: "Roles & access", icon: "roles", group: "Admin", module: "roles_permissions" },
  { href: "/app/system", label: "System", icon: "system", group: "Admin", module: "systems" },
  { href: "/app/import", label: "Bulk import", icon: "system", group: "Admin", module: "systems" },
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

/** Groups items in NAV_ITEMS order, dropping empty groups. */
export function groupedNavItems(items: NavItem[]): { group: NavGroup; items: NavItem[] }[] {
  const order: NavGroup[] = ["Overview", "Fleet", "Sites", "Commerce", "Automation", "Admin"]
  return order
    .map((group) => ({ group, items: items.filter((i) => i.group === group) }))
    .filter((g) => g.items.length > 0)
}
