import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { getMarina } from "@/lib/marina/data";
import {
  getMarinaBatteryStatus,
  getMarinaSensorCounts,
  getMarinaAlerts,
} from "@/lib/marina/dashboard";
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

import { MarinaTree } from "./marina-tree";

export const metadata = { title: "Marina" };

export default async function MarinaDetailPage({ params }: PageProps<"/app/marina/[id]">) {
  const viewer = await requireUser();
  if (!viewer.isSuperAdmin && !viewer.isCustomer && !can(viewer.permissions, "marina", "read")) {
    notFound();
  }

  const { id } = await params;
  const marinaId = Number(id);
  if (!Number.isInteger(marinaId)) notFound();

  const marina = await getMarina(marinaId);
  if (!marina) notFound();

  const [battery, counts, alerts, picker, users] = await Promise.all([
    getMarinaBatteryStatus(marinaId),
    getMarinaSensorCounts(marinaId),
    getMarinaAlerts(marinaId, 20),
    getDevicePickerOptions(),
    getActivationUserOptions(),
  ]);

  const canWrite = viewer.isSuperAdmin || can(viewer.permissions, "marina", "update");
  const canDelete = viewer.isSuperAdmin || can(viewer.permissions, "marina", "delete");

  return (
    <div className="grid gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/app/marina" />}>
          ← Marinas
        </Button>
        <h1 className="text-lg font-semibold">
          {marina.marinaName ?? marina.marinaCode}
          <span className="text-muted-foreground ml-2 font-mono text-sm">{marina.marinaCode}</span>
        </h1>
        <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">{marina.onNetType || "—"}</Badge>
          {marina.companyName ? <span>{marina.companyName}</span> : null}
          {[marina.city, marina.stateProvince, marina.country].filter(Boolean).length ? (
            <span>· {[marina.city, marina.stateProvince, marina.country].filter(Boolean).join(", ")}</span>
          ) : null}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sensors</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <Stat label="Total" value={counts.total} />
              <Stat label="Reporting" value={counts.reporting} />
              <Stat label="Silent" value={counts.silent} />
              <Stat label="Alarm active" value={counts.alarmActive} />
            </dl>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent marina alerts</CardTitle>
            <CardDescription>Live via Realtime once ingestion is running.</CardDescription>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-muted-foreground text-sm">No alerts.</p>
            ) : (
              <ul className="grid gap-1 text-sm">
                {alerts.map((a) => (
                  <li key={a.id}>
                    <span className="text-muted-foreground text-xs">
                      {new Date(a.createdAt).toLocaleString()}
                    </span>{" "}
                    {String(a.payload.subject ?? "alert")}
                    {a.payload.value != null ? `: ${String(a.payload.value)}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {battery.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Battery status</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Boat</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Voltage</TableHead>
                  <TableHead>Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {battery.map((b, i) => (
                  <TableRow key={i}>
                    <TableCell>{b.boatName}</TableCell>
                    <TableCell>{b.deviceName ?? "—"}</TableCell>
                    <TableCell>{b.voltage ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {b.readingAt ? new Date(b.readingAt).toLocaleString() : "never"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Layout</CardTitle>
          <CardDescription>Docks → slips → boats. A boat with no slip is unassigned.</CardDescription>
        </CardHeader>
        <CardContent>
          <MarinaTree
            marina={marina}
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
