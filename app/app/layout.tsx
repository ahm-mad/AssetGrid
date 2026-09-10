import Link from "next/link";

import { requireUser } from "@/lib/auth/dal";
import { visibleNavItems } from "@/lib/nav";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import { UserMenu } from "@/components/app-shell/user-menu";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireUser();
  const nav = visibleNavItems(user.permissions, {
    isSuperAdmin: user.isSuperAdmin,
    isCustomer: user.isCustomer,
  });
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "User";

  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr] md:grid-cols-[15rem_1fr] md:grid-rows-none">
      <aside className="bg-card hidden border-r md:flex md:flex-col">
        <div className="flex h-14 items-center px-5">
          <Link href="/app" className="font-semibold tracking-tight">
            ARMIT
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <SidebarNav items={nav} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="bg-card/80 supports-[backdrop-filter]:bg-card/60 sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b px-4 backdrop-blur md:justify-end">
          <Link href="/app" className="font-semibold tracking-tight md:hidden">
            ARMIT
          </Link>
          {user.impersonatorId ? (
            <span className="bg-amber-100 text-amber-900 rounded-md px-2 py-1 text-xs font-medium dark:bg-amber-950 dark:text-amber-200">
              Impersonating
            </span>
          ) : null}
          <UserMenu name={name} email={user.email} roleTitle={user.roleTitle} />
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
