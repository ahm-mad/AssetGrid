import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/page-guards";
import { getInventoryFormOptions } from "@/lib/inventory/data";
import { Button } from "@/components/ui/button";

import { InventoryDeviceForm } from "../inventory-device-form";

export const metadata = { title: "New inventory device" };

export default async function NewInventoryDevicePage() {
  const viewer = await requirePagePermission("inventory", "create");
  const options = await getInventoryFormOptions();
  const canSecrets = viewer.isSuperAdmin || viewer.roleTitle === "Admin";

  return (
    <div className="grid max-w-3xl gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/app/inventory" />}>
          ← Inventory
        </Button>
        <h1 className="text-lg font-semibold">New inventory device</h1>
        <p className="text-muted-foreground text-sm">
          Register one physical device. Bulk / CSV import lands in slice 10.
        </p>
      </div>

      <InventoryDeviceForm
        device={null}
        secrets={null}
        options={options}
        canEdit
        canSecrets={canSecrets}
      />
    </div>
  );
}
