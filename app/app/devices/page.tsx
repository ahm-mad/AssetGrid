import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/page-guards";
import { can } from "@/lib/auth/permissions";
import { listUserDevices, getDeviceFleetSummary } from "@/lib/devices/data";
import { getActivationUserOptions } from "@/lib/billing/data";
import { UI_MOCK } from "@/lib/mock/enabled";
import {
  listMockDevices,
  getMockFleetSummary,
  mapRealFleetToView,
  mapRealListToView,
  type MockDeviceRow,
} from "@/lib/mock/devices";

import { ClaimDeviceDialog } from "./claim-device-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatTile } from "@/components/charts/stat-tile";
import { StatusLabel } from "@/components/charts/status-dot";
import { BatteryIndicator } from "@/components/charts/battery-indicator";
import { SignalIndicator } from "@/components/charts/signal-indicator";

export const metadata = { title: "Devices" };

function timeAgo(mins: number): string {
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

const STATUS_TEXT: Record<MockDeviceRow["status"], string> = {
  online: "Online",
  warning: "Degraded",
  critical: "Offline",
};

export default async function DevicesPage({ searchParams }: PageProps<"/app/devices">) {
  const viewer = await requirePagePermission("inventory", "read", { allowCustomer: true });
  const isAdmin =
    viewer.isSuperAdmin ||
    can(viewer.permissions, "inventory", "update") ||
    can(viewer.permissions, "commerce", "create");
  const userOptions = isAdmin
    ? UI_MOCK
      ? [
          { id: "u1", name: "Alicia Ferreira", xnid: null },
          { id: "u2", name: "Marcus Wei", xnid: null },
          { id: "u3", name: "Priya Nair", xnid: null },
        ]
      : await getActivationUserOptions()
    : [];

  const sp = await searchParams;
  const page = Number(typeof sp.page === "string" ? sp.page : 1) || 1;
  const search = typeof sp.q === "string" ? sp.q : "";

  const fleet = UI_MOCK ? getMockFleetSummary() : mapRealFleetToView(await getDeviceFleetSummary());
  const result = UI_MOCK
    ? listMockDevices({ page, search, perPage: 25 })
    : mapRealListToView(await listUserDevices({ page, search, perPage: 25 }));
  const rows: MockDeviceRow[] = result.rows;
  const fleetHistory = fleet.history;

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
          <h1 className="text-xl font-semibold tracking-tight">Fleet devices</h1>
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
        <StatTile
          label="Total devices"
          value={fleet.total}
          history={fleetHistory?.total}
          status="online"
        />
        <StatTile label="Captured" value={fleet.captured} status="online" />
        <StatTile label="Charging now" value={fleet.charging} status="info" />
        <StatTile
          label="Active alerts"
          value={fleet.alerting}
          history={fleetHistory?.alerting}
          status={fleet.alerting > 0 ? "critical" : "online"}
        />
      </div>

      <form className="flex gap-2" action="/app/devices">
        <Input
          name="q"
          placeholder="Search name, owner, product…"
          defaultValue={search}
          className="max-w-sm"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Battery</TableHead>
                <TableHead>Signal</TableHead>
                <TableHead>Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground text-center">
                    No claimed devices found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      <Link href={`/app/devices/${d.id}`} className="hover:text-primary hover:underline">
                        {d.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{d.owner}</TableCell>
                    <TableCell className="text-muted-foreground">{d.company || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{d.product}</TableCell>
                    <TableCell>
                      <StatusLabel status={d.status}>{STATUS_TEXT[d.status]}</StatusLabel>
                    </TableCell>
                    <TableCell>
                      <BatteryIndicator percent={d.battery} />
                    </TableCell>
                    <TableCell>
                      <SignalIndicator dbm={d.signalDbm} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{timeAgo(d.lastSeenMinutesAgo)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

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
