import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { listDeviceDiagnostics } from "@/lib/analytics/data";
import { getArSummary, getRevenueReport, getOccupancyReport } from "@/lib/marina/pms/reports";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart } from "@/components/charts/bar-chart";

export const metadata = { title: "Reports" };

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default async function ReportsPage({
  searchParams,
}: PageProps<"/app/reports">) {
  const viewer = await requireUser();
  const canDiagnostics = viewer.isSuperAdmin || can(viewer.permissions, "inventory", "read");
  const canMarina =
    viewer.isSuperAdmin || viewer.isCustomer || can(viewer.permissions, "marina", "read");
  const canExport = viewer.isSuperAdmin || can(viewer.permissions, "commerce", "read");
  if (!canDiagnostics && !canMarina && !canExport) notFound();

  const sp = await searchParams;
  const search = typeof sp.q === "string" ? sp.q : undefined;
  const page = typeof sp.page === "string" ? Math.max(1, Number(sp.page) || 1) : 1;

  const [diagnostics, revenue, occupancy, arSummary] = await Promise.all([
    canDiagnostics ? listDeviceDiagnostics({ page, perPage: 25, search }) : null,
    canMarina ? getRevenueReport({}) : null,
    canMarina ? getOccupancyReport({}) : null,
    canMarina ? getArSummary() : null,
  ]);

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-lg font-semibold">Reports &amp; diagnostics</h1>
        <p className="text-muted-foreground text-sm">
          Device diagnostics, marina financials, and data exports.
        </p>
      </div>

      {canExport ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exports</CardTitle>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline" render={<Link href="/api/export/users-full" prefetch={false} />}>
              Download users CSV
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {diagnostics ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Device diagnostics</CardTitle>
            <CardDescription>
              {diagnostics.total} device{diagnostics.total === 1 ? "" : "s"} in scope. Alert /
              malfunction state populates once ingestion is running.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <form className="flex gap-2">
              <input
                type="search"
                name="q"
                defaultValue={search}
                placeholder="dev EUI, xNID, name…"
                className="border-input rounded-md border px-2 py-1 text-sm"
              />
              <Button size="sm" type="submit" variant="outline">
                Search
              </Button>
            </form>
            {diagnostics.rows.length === 0 ? (
              <p className="text-muted-foreground text-sm">No devices.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dev EUI</TableHead>
                      <TableHead>xNID</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Place</TableHead>
                      <TableHead>Alerts</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diagnostics.rows.map((d) => (
                      <TableRow key={d.inventoryDeviceId}>
                        <TableCell className="font-mono text-xs">{d.deveui ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{d.xnid ?? "—"}</TableCell>
                        <TableCell className="text-xs">{d.email ?? "—"}</TableCell>
                        <TableCell className="text-xs">{d.companyName ?? "—"}</TableCell>
                        <TableCell className="text-xs">{d.productName ?? "—"}</TableCell>
                        <TableCell className="text-xs">{d.placeInfo || "—"}</TableCell>
                        <TableCell>
                          {d.alertCount > 0 ? (
                            <Badge variant="destructive">{d.alertCount}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {d.malfunction ? d.malfunctionActiveStatus : d.totalPackets ? "reporting" : "silent"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {diagnostics.totalPages > 1 ? (
              <div className="flex gap-2 text-sm">
                {page > 1 ? (
                  <Button size="sm" variant="ghost" render={<Link href={`/app/reports?page=${page - 1}${search ? `&q=${encodeURIComponent(search)}` : ""}`} />}>
                    ← Prev
                  </Button>
                ) : null}
                <span className="text-muted-foreground self-center">
                  Page {page} of {diagnostics.totalPages}
                </span>
                {page < diagnostics.totalPages ? (
                  <Button size="sm" variant="ghost" render={<Link href={`/app/reports?page=${page + 1}${search ? `&q=${encodeURIComponent(search)}` : ""}`} />}>
                    Next →
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {revenue && occupancy && arSummary ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Marina financials</CardTitle>
            <CardDescription>This month, across marinas in your scope.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <section>
              <h2 className="mb-2 text-sm font-medium">Revenue per dock</h2>
              {revenue.perDock.length === 0 ? (
                <p className="text-muted-foreground text-sm">No reservation revenue this month.</p>
              ) : (
                <BarChart
                  data={revenue.perDock.map((d) => ({ label: d.dockName, value: d.revenue }))}
                  format="currency"
                />
              )}
            </section>
            <section>
              <h2 className="mb-2 text-sm font-medium">Occupancy per dock</h2>
              {occupancy.perDock.length === 0 ? (
                <p className="text-muted-foreground text-sm">No docks in scope.</p>
              ) : (
                <BarChart
                  data={occupancy.perDock.map((d) => ({ label: d.dockName, value: d.occupancyPercent }))}
                  format="percent"
                  yMax={100}
                />
              )}
            </section>
            <section>
              <h2 className="mb-2 text-sm font-medium">AR summary per company</h2>
              {arSummary.perCompany.length === 0 ? (
                <p className="text-muted-foreground text-sm">No invoices.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Total AR</TableHead>
                      <TableHead>0-30</TableHead>
                      <TableHead>31-60</TableHead>
                      <TableHead>61-90</TableHead>
                      <TableHead>90+</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {arSummary.perCompany.map((c) => (
                      <TableRow key={`${c.companyId}-${c.companyName}`}>
                        <TableCell>{c.companyName}</TableCell>
                        <TableCell>{money(c.totalAr)}</TableCell>
                        <TableCell>{money(c.aging["0-30"])}</TableCell>
                        <TableCell>{money(c.aging["31-60"])}</TableCell>
                        <TableCell>{money(c.aging["61-90"])}</TableCell>
                        <TableCell>{money(c.aging["90+"])}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
