import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { getBuilding } from "@/lib/buildings/data";
import { getBuildingBatteryStatus, getBuildingSensorCounts } from "@/lib/buildings/dashboard";
import { getDevicePickerOptions } from "@/lib/inventory/data";
import { getActivationUserOptions } from "@/lib/billing/data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { BuildingTree } from "./building-tree";

export const metadata = { title: "Building" };

export default async function BuildingPage({ params }: PageProps<"/app/buildings/[id]">) {
  const viewer = await requireUser();
  if (!viewer.isSuperAdmin && !can(viewer.permissions, "buildings", "read")) notFound();

  const { id } = await params;
  const buildingId = Number(id);
  if (!Number.isInteger(buildingId)) notFound();

  const building = await getBuilding(buildingId);
  if (!building) notFound();

  const [battery, counts, picker, users] = await Promise.all([
    getBuildingBatteryStatus(buildingId),
    getBuildingSensorCounts(buildingId),
    getDevicePickerOptions(),
    getActivationUserOptions(),
  ]);

  const canWrite = viewer.isSuperAdmin || can(viewer.permissions, "buildings", "update");
  const canDelete = viewer.isSuperAdmin || can(viewer.permissions, "buildings", "delete");

  return (
    <div className="grid gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/app/buildings" />}>
          ← Buildings
        </Button>
        <h1 className="font-mono text-lg font-semibold">{building.buildingCode}</h1>
        <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">{building.onNetType || "—"}</Badge>
          {building.companyName ? <span>{building.companyName}</span> : null}
          {[building.streetAddress, building.city, building.stateProvince].filter(Boolean).length ? (
            <span>
              · {[building.streetAddress, building.city, building.stateProvince].filter(Boolean).join(", ")}
            </span>
          ) : null}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sensors</CardTitle>
            <CardDescription>Live counts from the latest-reading cache.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <Stat label="Total" value={counts.total} />
              <Stat label="Reporting (24h)" value={counts.reporting} />
              <Stat label="Silent" value={counts.silent} />
              <Stat label="Alarm active" value={counts.alarmActive} />
              <Stat label="Motion" value={counts.motion} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Battery status</CardTitle>
          </CardHeader>
          <CardContent>
            {battery.length === 0 ? (
              <p className="text-muted-foreground text-sm">No devices mounted yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room</TableHead>
                    <TableHead>Voltage</TableHead>
                    <TableHead>Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {battery.map((b) => (
                    <TableRow key={b.siteId}>
                      <TableCell>{b.roomName}</TableCell>
                      <TableCell>{b.voltage ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {b.readingAt ? new Date(b.readingAt).toLocaleString() : "never"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Structure</CardTitle>
          <CardDescription>Floors → units → areas → sites (a site is one mounted device).</CardDescription>
        </CardHeader>
        <CardContent>
          <BuildingTree
            building={building}
            canWrite={canWrite}
            canDelete={canDelete}
            inventoryDevices={picker.inventoryDevices}
            users={users}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-base font-medium">{value}</dd>
    </div>
  );
}
