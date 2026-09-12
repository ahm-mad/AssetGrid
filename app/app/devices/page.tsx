import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/page-guards";
import { can } from "@/lib/auth/permissions";
import { listUserDevices, getDeviceFleetSummary } from "@/lib/devices/data";
import { getActivationUserOptions } from "@/lib/billing/data";

import { ClaimDeviceDialog } from "./claim-device-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatTile } from "@/components/charts/stat-tile";

export const metadata = { title: "Devices" };

export default async function DevicesPage({ searchParams }: PageProps<"/app/devices">) {
  const viewer = await requirePagePermission("inventory", "read", { allowCustomer: true });
  const isAdmin =
    viewer.isSuperAdmin ||
    can(viewer.permissions, "inventory", "update") ||
    can(viewer.permissions, "commerce", "create");
  const userOptions = isAdmin ? await getActivationUserOptions() : [];

  const sp = await searchParams;
  const page = Number(typeof sp.page === "string" ? sp.page : 1) || 1;
  const search = typeof sp.q === "string" ? sp.q : "";

  const [result, fleet] = await Promise.all([
    listUserDevices({ page, search, perPage: 25 }),
    getDeviceFleetSummary(),
  ]);

  const mkHref = (p: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    params.set("page", String(p));
    return `/app/devices?${params.toString()}`;
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Claimed devices</h1>
          <p className="text-muted-foreground text-sm">
            {result.total} devices activated to an end user
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" render={<Link href="/app/inventory" />}>
            Inventory registry
          </Button>
          <ClaimDeviceDialog selfId={viewer.id} users={isAdmin ? userOptions : null} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Total devices" value={fleet.total} />
        <StatTile label="Captured" value={fleet.captured} />
        <StatTile label="Charging now" value={fleet.charging} />
        <StatTile label="Active alerts" value={fleet.alerting} status={fleet.alerting > 0 ? "warning" : undefined} />
      </div>

      <form className="flex gap-2" action="/app/devices">
        <Input
          name="q"
          placeholder="Search name, dev EUI, xnid…"
          defaultValue={search}
          className="max-w-sm"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Charging</TableHead>
              <TableHead>Last reading</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground text-center">
                  No claimed devices — the activation flow lands in slice 4, and existing devices
                  arrive with the data migration (Phase N+1).
                </TableCell>
              </TableRow>
            ) : (
              result.rows.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    <Link href={`/app/devices/${d.id}`} className="hover:underline">
                      {d.deviceName ?? `Device #${d.id}`}
                    </Link>
                  </TableCell>
                  <TableCell>{d.ownerName ?? "—"}</TableCell>
                  <TableCell>{d.productName ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={d.status === "captured" ? "secondary" : "outline"}>
                      {d.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {d.isOn == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Badge variant={d.isOn ? "secondary" : "outline"}>
                        {d.isOn ? "on" : "off"}
                        {d.isCharging ? " · charging" : ""}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.lastReadingAt ? new Date(d.lastReadingAt).toLocaleString() : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Page {result.page} of {result.totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={result.page <= 1}
            render={<Link href={mkHref(result.page - 1)} />}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={result.page >= result.totalPages}
            render={<Link href={mkHref(result.page + 1)} />}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
