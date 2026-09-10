import Link from "next/link";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@/lib/auth/page-guards";
import { getEntitlement } from "@/lib/billing/data";
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

export const metadata = { title: "Entitlement" };

export default async function EntitlementPage({ params }: PageProps<"/app/billing/[id]">) {
  await requirePagePermission("commerce", "read", { allowCustomer: false });

  const { id } = await params;
  const entId = Number(id);
  if (!Number.isInteger(entId)) notFound();

  const ent = await getEntitlement(entId);
  if (!ent) notFound();

  const rows: [string, string | null][] = [
    ["Plan", ent.planName ?? ent.planCode],
    ["User", ent.userName],
    ["Owner xnid", ent.ownerXnid],
    ["Billing xnid", ent.billingXnid],
    ["Dealer xnid", ent.dealerXnid],
    ["Billing mode", ent.billingMode],
    ["Source", ent.source],
    ["Payment provider", ent.paymentProvider],
    ["Stripe customer", ent.providerCustomerId],
    ["Stripe subscription", ent.providerSubscriptionId],
    ["Started", ent.startedAt ? new Date(ent.startedAt).toLocaleString() : null],
    ["Cancelled", ent.cancelledAt ? new Date(ent.cancelledAt).toLocaleString() : null],
  ];

  return (
    <div className="grid max-w-3xl gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/app/billing" />}>
          ← Billing
        </Button>
        <h1 className="text-lg font-semibold">Entitlement #{ent.id}</h1>
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Badge variant={ent.status === "active" ? "secondary" : "outline"}>{ent.status}</Badge>
          <span>
            {ent.activeDeviceCount}
            {ent.maxDevicesAllowed === -1 ? " / ∞" : ent.maxDevicesAllowed != null ? ` / ${ent.maxDevicesAllowed}` : ""} devices
          </span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
            {rows
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="break-all">{v}</dd>
                </div>
              ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Device assignments</CardTitle>
          <CardDescription>{ent.assignments.length} devices linked to this entitlement.</CardDescription>
        </CardHeader>
        <CardContent>
          {ent.assignments.length === 0 ? (
            <p className="text-muted-foreground text-sm">No assignments.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>xnid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ent.assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      {a.userDeviceId ? (
                        <Link href={`/app/devices/${a.userDeviceId}`} className="hover:underline">
                          {a.deviceName ?? `#${a.userDeviceId}`}
                        </Link>
                      ) : (
                        a.deviceName ?? "—"
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs break-all">{a.xnid}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === "active" ? "secondary" : "outline"}>{a.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(a.assignedAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
