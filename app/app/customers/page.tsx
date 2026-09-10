import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/page-guards";
import { listUsers } from "@/lib/users/data";
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

  const result = await listUsers({ page, search, roleTypeId, perPage: 20 });

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
          <h1 className="text-lg font-semibold">Customers</h1>
          <p className="text-muted-foreground text-sm">{result.total} users</p>
        </div>
        {canCreate ? (
          <Button render={<Link href="/app/customers/new" />}>New user</Button>
        ) : null}
      </div>

      <form className="flex gap-2" action="/app/customers">
        <Input name="q" placeholder="Search name or xnid…" defaultValue={search} className="max-w-xs" />
        {roleTypeId ? <input type="hidden" name="role" value={roleTypeId} /> : null}
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <div className="overflow-x-auto rounded-md border">
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
                    <Link href={`/app/customers/${u.id}`} className="hover:underline">
                      {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
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
                  <TableCell>{u.companyName ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString()}
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
