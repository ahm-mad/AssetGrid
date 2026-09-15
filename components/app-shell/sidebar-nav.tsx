"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  PackageSearch,
  ShoppingBag,
  Building2,
  Anchor,
  MessageSquare,
  BellRing,
  FileBarChart,
  ScanSearch,
  ShieldCheck,
  Settings2,
  type LucideIcon,
} from "lucide-react"

import { cn } from "cn"
import type { NavGroup, NavIcon, NavItem } from "@/lib/nav"

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  inventory: PackageSearch,
  catalog: ShoppingBag,
  buildings: Building2,
  marina: Anchor,
  messaging: MessageSquare,
  rules: BellRing,
  reports: FileBarChart,
  customers: ScanSearch,
  roles: ShieldCheck,
  system: Settings2,
}

/** Takes already-grouped nav items — grouping itself happens server-side (groupedNavItems in lib/nav.ts) since that module also pulls in a server-only permissions helper. */
export function SidebarNav({ groups }: { groups: { group: NavGroup; items: NavItem[] }[] }) {
  const pathname = usePathname()

  return (
    <nav className="grid gap-4 px-2">
      {groups.map(({ group, items: groupItems }) => (
        <div key={group}>
          <p className="sidebar-group-label px-3 pb-1.5">{group}</p>
          <div className="grid gap-0.5">
            {groupItems.map((item) => {
              const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href)
              const Icon = ICONS[item.icon]
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground font-medium",
                  )}
                >
                  <Icon className="size-4 opacity-80" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}
