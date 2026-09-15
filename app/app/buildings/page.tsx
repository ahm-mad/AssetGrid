import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/page-guards";
import { can } from "@/lib/auth/permissions";
import { listBuildings } from "@/lib/buildings/data";
import { getCompanyOptions } from "@/lib/companies/data";
import { UI_MOCK } from "@/lib/mock/enabled";
import { MOCK_BUILDINGS, mapRealToView, buildingSites } from "@/lib/mock/buildings";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/charts/stat-tile";
import { BarChart } from "@/components/charts/bar-chart";
import { StatusLabel } from "@/components/charts/status-dot";
import { GoogleMapEmbed } from "@/components/charts/google-map-embed";

import { NewBuildingButton } from "./new-building-button";

export const metadata = { title: "Buildings" };

export default async function BuildingsPage() {
  const viewer = await requirePagePermission("buildings", "read");
  const companies = UI_MOCK ? [] : await getCompanyOptions();
  const buildings = UI_MOCK ? MOCK_BUILDINGS : mapRealToView(await listBuildings());
  const canCreate = viewer.isSuperAdmin || can(viewer.permissions, "buildings", "create");
  const totalDevices = buildings.reduce((sum, b) => sum + b.siteCount, 0);
  const deviceChart = buildings.map((b) => ({ label: b.buildingCode, value: b.siteCount }));
  const sites = buildingSites(buildings);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Buildings</h1>
          <p className="text-muted-foreground text-sm">
            {buildings.length} monitored locations · building → floor → unit → area → site.
          </p>
        </div>
        {canCreate ? <NewBuildingButton companies={companies} /> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Buildings" value={buildings.length} status="online" />
        <StatTile label="Monitored sites" value={totalDevices} status="info" />
      </div>

      {sites.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Site locations</CardTitle>
            <CardDescription>Where each managed building actually sits — live map.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sites.map((s) => (
                <div key={s.id} className="overflow-hidden rounded-md border">
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <div>
                      <p className="eyebrow">{s.label}</p>
                      <p className="text-muted-foreground text-xs">{s.sublabel}</p>
                    </div>
                    <StatusLabel status={s.status}>
                      {s.status === "online" ? "Nominal" : s.status === "warning" ? "Attention" : "Critical"}
                    </StatusLabel>
                  </div>
                  <GoogleMapEmbed lat={s.lat} lng={s.lng} label={s.label} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {deviceChart.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Devices per building</CardTitle>
            <CardDescription>Sites with an active sensor, by building.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart data={deviceChart} color="var(--chart-3)" />
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sites</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buildings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground text-center">
                    No buildings yet.
                  </TableCell>
                </TableRow>
              ) : (
                buildings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/app/buildings/${b.id}`} className="hover:text-primary hover:underline">
                        {b.buildingCode}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{b.onNetType || "—"}</TableCell>
                    <TableCell>{b.companyName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {[b.city, b.stateProvince, b.country].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusLabel status={b.status}>
                        {b.status === "online" ? "Nominal" : b.status === "warning" ? "Attention" : "Critical"}
                      </StatusLabel>
                    </TableCell>
                    <TableCell>{b.siteCount}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
