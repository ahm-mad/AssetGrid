import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/page-guards";
import { can } from "@/lib/auth/permissions";
import { listSafeguardConfigurations, getDevicePickerOptions } from "@/lib/inventory/data";
import { Button } from "@/components/ui/button";

import { SafeguardsClient } from "./safeguards-client";

export const metadata = { title: "Safeguards" };

export default async function SafeguardsPage() {
  const viewer = await requirePagePermission("rulebuilder", "read");
  const [rows, options] = await Promise.all([
    listSafeguardConfigurations(),
    getDevicePickerOptions(),
  ]);

  const canCreate = viewer.isSuperAdmin || can(viewer.permissions, "rulebuilder", "create");
  const canEdit = viewer.isSuperAdmin || can(viewer.permissions, "rulebuilder", "update");
  const canDelete = viewer.isSuperAdmin || can(viewer.permissions, "rulebuilder", "delete");

  return (
    <div className="grid gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/app/inventory" />}>
          ← Inventory
        </Button>
        <h1 className="text-lg font-semibold">Safeguard configurations</h1>
        <p className="text-muted-foreground text-sm">
          Abnormal-alert throttling per device / user. Controls the alert engine&apos;s
          support-notification cadence (slice 5).
        </p>
      </div>

      <SafeguardsClient
        rows={rows}
        options={options}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  );
}
