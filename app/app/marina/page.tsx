import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/page-guards";
import { can } from "@/lib/auth/permissions";
import { listMarinas } from "@/lib/marina/data";
import { getCompanyOptions } from "@/lib/companies/data";
import { UI_MOCK } from "@/lib/mock/enabled";
import { listMockMarinas, getMockMarinaOccupancy } from "@/lib/mock/marina";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NetworkMap } from "@/components/charts/network-map";
import { Anchor } from "lucide-react";

import { NewMarinaButton } from "./new-marina-button";

export const metadata = { title: "Marinas" };

export default async function MarinaPage() {
  const viewer = await requirePagePermission("marina", "read", { allowCustomer: true });
  const companies = UI_MOCK ? [] : await getCompanyOptions();
  const marinas = UI_MOCK ? listMockMarinas() : await listMarinas();
  const canCreate = viewer.isSuperAdmin || can(viewer.permissions, "marina", "create");

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Marinas</h1>
          <p className="text-muted-foreground text-sm">
            {marinas.length} marinas · marina → dock → slip → boat.
          </p>
        </div>
        {canCreate ? <NewMarinaButton companies={companies} /> : null}
      </div>

      {UI_MOCK ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Occupancy by marina</CardTitle>
            <CardDescription>Slip occupancy across the whole portfolio.</CardDescription>
          </CardHeader>
          <CardContent>
            <NetworkMap nodes={getMockMarinaOccupancy()} icon={Anchor} unitLabel="slips" metricLabel="occupied" />
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden py-0">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Docks</TableHead>
              <TableHead>Slips</TableHead>
              <TableHead>Boats</TableHead>
              <TableHead>Map</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {marinas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground text-center">
                  No marinas yet.
                </TableCell>
              </TableRow>
            ) : (
              marinas.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/app/marina/${m.id}`} className="hover:underline">
                      {m.marinaCode}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{m.marinaName ?? "—"}</TableCell>
                  <TableCell>{m.companyName ?? "—"}</TableCell>
                  <TableCell>{m.dockCount}</TableCell>
                  <TableCell>{m.slipCount}</TableCell>
                  <TableCell>{m.boatCount}</TableCell>
                  <TableCell>
                    {m.hasSvg ? <Badge variant="secondary">SVG</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
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
