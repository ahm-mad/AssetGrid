import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";

import { ImportPanels } from "./import-panels";

export const metadata = { title: "Bulk import" };

export default async function ImportPage() {
  const viewer = await requireUser();
  const perms = {
    inventory: viewer.isSuperAdmin || can(viewer.permissions, "inventory", "create"),
    building: viewer.isSuperAdmin || can(viewer.permissions, "buildings", "create"),
    marina: viewer.isSuperAdmin || can(viewer.permissions, "marina", "create"),
    customers: viewer.isSuperAdmin || can(viewer.permissions, "systems", "create"),
  };
  if (!perms.inventory && !perms.building && !perms.marina && !perms.customers) notFound();

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-lg font-semibold">Bulk import</h1>
        <p className="text-muted-foreground text-sm">
          Upload a CSV to create records in bulk. Rows that fail validation are skipped and listed
          in a downloadable error report.
        </p>
      </div>
      <ImportPanels perms={perms} />
    </div>
  );
}
