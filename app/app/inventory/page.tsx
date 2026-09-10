import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/page-guards";
import { can } from "@/lib/auth/permissions";
import { listInventoryDevices } from "@/lib/inventory/data";
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

export const metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: PageProps<"/app/inventory">) {
  const viewer = await requirePagePermission("inventory", "read", { allowCustomer: true });
  const canCreate = viewer.isSuperAdmin || can(viewer.permissions, "inventory", "create");

  const sp = await searchParams;
  const page = Number(typeof sp.page === "string" ? sp.page : 1) || 1;
  const search = typeof sp.q === "string" ? sp.q : "";

  const result = await listInventoryDevices({ page, search, perPage: 25 });

  const mkHref = (p: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    params.set("page", String(p));
    return `/app/inventory?${params.toString()}`;
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Inventory devices</h1>
          <p className="text-muted-foreground text-sm">{result.total} physical devices in the registry</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" render={<Link href="/app/inventory/containers" />}>
            Containers
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/app/inventory/safeguards" />}>
            Safeguards
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/app/inventory/device-health" />}>
            Device health
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/app/devices" />}>
            Claimed devices
          </Button>
          {canCreate ? (
            <Button size="sm" render={<Link href="/app/inventory/new" />}>
              New device
            </Button>
          ) : null}
        </div>
      </div>

      <form className="flex gap-2" action="/app/inventory">
        <Input
          name="q"
          placeholder="Search dev EUI, xnid, activation code, name…"
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
              <TableHead>Dev EUI</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Container</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Claimed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground text-center">
                  No inventory devices — these are loaded by the data migration (Phase N+1) or created here.
                </TableCell>
              </TableRow>
            ) : (
              result.rows.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    <Link href={`/app/inventory/${d.id}`} className="hover:underline">
                      {d.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{d.devEui ?? "—"}</TableCell>
                  <TableCell>{d.productName ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{d.containerCode ?? "—"}</TableCell>
                  <TableCell>{d.companyName ?? "—"}</TableCell>
                  <TableCell>
                    {d.claimed ? (
                      <Badge variant="secondary">{d.userDeviceStatus ?? "yes"}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
