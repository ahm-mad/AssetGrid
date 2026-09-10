import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import {
  getDeviceSecrets,
  getInventoryDevice,
  getInventoryFormOptions,
} from "@/lib/inventory/data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { InventoryDeviceForm } from "../inventory-device-form";
import { DeleteInventoryDevice } from "./delete-device";

export const metadata = { title: "Inventory device" };

export default async function InventoryDevicePage({
  params,
}: PageProps<"/app/inventory/[id]">) {
  const viewer = await requireUser();
  if (!viewer.isSuperAdmin && !viewer.isCustomer && !can(viewer.permissions, "inventory", "read")) {
    notFound();
  }

  const { id } = await params;
  const deviceId = Number(id);
  if (!Number.isInteger(deviceId)) notFound();

  const device = await getInventoryDevice(deviceId);
  if (!device) notFound();

  const canEdit = viewer.isSuperAdmin || can(viewer.permissions, "inventory", "update");
  const canDelete = viewer.isSuperAdmin || can(viewer.permissions, "inventory", "delete");
  const canSecrets = viewer.isSuperAdmin || viewer.roleTitle === "Admin";

  const [options, secrets] = await Promise.all([
    getInventoryFormOptions(),
    canSecrets ? getDeviceSecrets(deviceId) : Promise.resolve(null),
  ]);

  return (
    <div className="grid max-w-3xl gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Button variant="ghost" size="sm" render={<Link href="/app/inventory" />}>
            ← Inventory
          </Button>
          <h1 className="text-lg font-semibold">{device.name}</h1>
          <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono">{device.devEui ?? "no dev EUI"}</span>
            {device.deviceTypeName ? <Badge variant="secondary">{device.deviceTypeName}</Badge> : null}
            {device.claimed ? <Badge variant="outline">claimed</Badge> : null}
          </p>
        </div>
        {canDelete ? <DeleteInventoryDevice id={device.id} disabled={device.claimed} /> : null}
      </div>

      {device.claimed ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Claimed device</CardTitle>
            <CardDescription>
              This device is activated as user device #{device.userDeviceId}
              {device.ownerName ? ` — ${device.ownerName}` : ""} ({device.userDeviceStatus}).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" render={<Link href={`/app/devices/${device.userDeviceId}`} />}>
              Open claimed device
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Device</CardTitle>
          <CardDescription>
            Container {device.containerCode ?? "—"} · product {device.productName ?? "—"} · company{" "}
            {device.companyName ?? "—"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InventoryDeviceForm
            device={device}
            secrets={secrets}
            options={options}
            canEdit={canEdit}
            canSecrets={canSecrets}
          />
        </CardContent>
      </Card>

      {!canSecrets ? (
        <p className="text-muted-foreground text-xs">
          LoRaWAN keys are only visible to a Super Admin or an Admin with inventory write access.
        </p>
      ) : null}
    </div>
  );
}
