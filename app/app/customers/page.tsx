import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/page-guards";
import { listUsers, getCustomerSummary } from "@/lib/users/data";
import { UI_MOCK } from "@/lib/mock/enabled";
import {
  listMockCustomers,
  getMockCustomerSummary,
  mapRealListToView,
  mapRealSummaryToView,
} from "@/lib/mock/customers";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/charts/stat-tile";
import { BarChart } from "@/components/charts/bar-chart";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/app/customers">) {
  const viewer = await requirePagePermission("commerce", "read", { allowCustomer: false });
  const canCreate =
    viewer.isSuperAdmin ||
    viewer.permissions.some((p) => p.code === "commerce" && p.can_create);

  const sp = await searchParams;
  const page = Number(typeof sp.page === "string" ? sp.page : 1) || 1;
  const search = typeof sp.q === "string" ? sp.q : "";
  const roleTypeId = sp.role ? Number(sp.role) : undefined;

  const result = UI_MOCK
    ? listMockCustomers({ page, search, perPage: 20 })
    : mapRealListToView(await listUsers({ page, search, roleTypeId, perPage: 20 }));
  const summary = UI_MOCK ? getMockCustomerSummary() : mapRealSummaryToView(await getCustomerSummary());

  const mkHref = (p: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (roleTypeId) params.set("role", String(roleTypeId));
    params.set("page", String(p));
    return `/app/customers?${params.toString()}`;
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Customers</h1>
          <p className="text-muted-foreground text-sm">{result.total} users across {summary.companyCount} companies</p>
        </div>
        {canCreate ? (
          <Button render={<Link href="/app/customers/new" />}>New user</Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Total customers" value={summary.total} history={summary.history} status="online" />
        <StatTile label="Companies" value={summary.companyCount} status="info" />
      </div>

      {summary.perCompany.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customers by company</CardTitle>
            <CardDescription>Distribution across the account portfolio.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart data={summary.perCompany} color="var(--chart-2)" />
          </CardContent>
        </Card>
      ) : null}

      <form className="flex gap-2" action="/app/customers">
        <Input name="q" placeholder="Search name or company…" defaultValue={search} className="max-w-xs" />
        {roleTypeId ? <input type="hidden" name="role" value={roleTypeId} /> : null}
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-center">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                result.rows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <Link href={`/app/customers/${u.id}`} className="hover:text-primary hover:underline">
                        {u.name}
                      </Link>
                      {u.deletedAt ? (
                        <Badge variant="outline" className="ml-2">
                          deleted
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{u.roleTitle}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.companyName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </TableCell>
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
