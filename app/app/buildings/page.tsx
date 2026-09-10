import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/page-guards";
import { can } from "@/lib/auth/permissions";
import { listBuildings } from "@/lib/buildings/data";
import { getCompanyOptions } from "@/lib/companies/data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { NewBuildingButton } from "./new-building-button";

export const metadata = { title: "Buildings" };

export default async function BuildingsPage() {
  const viewer = await requirePagePermission("buildings", "read");
  const [buildings, companies] = await Promise.all([listBuildings(), getCompanyOptions()]);
  const canCreate = viewer.isSuperAdmin || can(viewer.permissions, "buildings", "create");

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Buildings</h1>
          <p className="text-muted-foreground text-sm">
            {buildings.length} monitored locations · building → floor → unit → area → site.
          </p>
        </div>
        {canCreate ? <NewBuildingButton companies={companies} /> : null}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Sites</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buildings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground text-center">
                  No buildings yet.
                </TableCell>
              </TableRow>
            ) : (
              buildings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/app/buildings/${b.id}`} className="hover:underline">
                      {b.buildingCode}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{b.onNetType || "—"}</Badge>
                  </TableCell>
                  <TableCell>{b.companyName ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {[b.city, b.stateProvince, b.country].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell>{b.siteCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
