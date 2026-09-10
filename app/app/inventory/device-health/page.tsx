import Link from "next/link";

import { requireUser } from "@/lib/auth/dal";
import { notFound } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { listDeviceHealthSchedulers, getDevicePickerOptions } from "@/lib/inventory/data";
import { Button } from "@/components/ui/button";

import { DeviceHealthClient } from "./device-health-client";

export const metadata = { title: "Device health" };

export default async function DeviceHealthPage() {
  const viewer = await requireUser();
  const allowed =
    viewer.isSuperAdmin || viewer.isCustomer || can(viewer.permissions, "messaging", "read");
  if (!allowed) notFound();

  const [rows, options] = await Promise.all([
    listDeviceHealthSchedulers(viewer.id),
    getDevicePickerOptions(),
  ]);

  return (
    <div className="grid gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/app/inventory" />}>
          ← Inventory
        </Button>
        <h1 className="text-lg font-semibold">Device-health schedulers</h1>
        <p className="text-muted-foreground text-sm">
          Your recurring device-health report jobs. The runner is a scheduled job (slice 5).
        </p>
      </div>

      <DeviceHealthClient rows={rows} inventoryDevices={options.inventoryDevices} />
    </div>
  );
}
