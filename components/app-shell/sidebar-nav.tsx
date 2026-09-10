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
import type { NavIcon, NavItem } from "@/lib/nav"

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

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname()

  return (
    <nav className="grid gap-0.5 px-2">
      {items.map((item) => {
        const active =
          item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href)
        const Icon = ICONS[item.icon]
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
