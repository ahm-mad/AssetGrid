import Link from "next/link";
import "leaflet/dist/leaflet.css";

import { requireUser } from "@/lib/auth/dal";
import { visibleNavItems, groupedNavItems } from "@/lib/nav";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import { UserMenu } from "@/components/app-shell/user-menu";
import { ImpersonationBanner } from "@/components/app-shell/impersonation-banner";
import { StatusDot } from "@/components/charts/status-dot";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireUser();
  const nav = visibleNavItems(user.permissions, {
    isSuperAdmin: user.isSuperAdmin,
    isCustomer: user.isCustomer,
  });
  const navGroups = groupedNavItems(nav);
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "User";

  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr] md:grid-cols-[15rem_1fr] md:grid-rows-none">
      <aside className="bg-sidebar border-sidebar-border hidden border-r md:sticky md:top-0 md:flex md:h-screen md:flex-col">
        <div className="flex h-14 items-center gap-2 border-b px-5">
          <Link href="/app" className="font-heading text-sm font-semibold tracking-wide uppercase">
            AssetGrid
          </Link>
        </div>
        <div className="scrollbar-none flex-1 overflow-y-auto py-3">
          <SidebarNav groups={navGroups} />
        </div>
        {/* <div className="eyebrow border-t px-5 py-3">AssetGrid v1 · Portfolio build</div> */}
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="bg-background sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b px-4 md:justify-end">
          <Link href="/app" className="font-semibold tracking-tight md:hidden">
            AssetGrid
          </Link>
          {user.impersonatorId ? (
            <ImpersonationBanner />
          ) : (
            <span className="eyebrow hidden items-center gap-2 md:mr-auto md:flex">
              <StatusDot status="online" />
              All systems operational
            </span>
          )}
          <UserMenu name={name} email={user.email} roleTitle={user.roleTitle} />
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
