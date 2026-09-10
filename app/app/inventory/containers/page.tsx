import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/page-guards";
import { can } from "@/lib/auth/permissions";
import { listContainers } from "@/lib/inventory/data";
import { Button } from "@/components/ui/button";

import { ContainersTable } from "./containers-table";

export const metadata = { title: "Containers" };

export default async function ContainersPage() {
  const viewer = await requirePagePermission("inventory", "read");
  const containers = await listContainers();

  const canCreate = viewer.isSuperAdmin || can(viewer.permissions, "inventory", "create");
  const canEdit = viewer.isSuperAdmin || can(viewer.permissions, "inventory", "update");
  const canDelete = viewer.isSuperAdmin || can(viewer.permissions, "inventory", "delete");

  return (
    <div className="grid max-w-2xl gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/app/inventory" />}>
          ← Inventory
        </Button>
        <h1 className="text-lg font-semibold">Containers</h1>
        <p className="text-muted-foreground text-sm">
          Shipping / batch codes. A Dealer&apos;s data scope is a set of these codes.
        </p>
      </div>

      <ContainersTable
        rows={containers}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  );
}
