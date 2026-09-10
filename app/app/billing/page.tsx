import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/page-guards";
import {
  listEntitlements,
  listActivationAttempts,
  listPayments,
} from "@/lib/billing/data";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  await requirePagePermission("commerce", "read", { allowCustomer: false });

  const [ents, attempts, payments] = await Promise.all([
    listEntitlements({ perPage: 50 }),
    listActivationAttempts({ perPage: 50 }),
    listPayments({ perPage: 50 }),
  ]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Billing</h1>
          <p className="text-muted-foreground text-sm">
            Entitlements, activation attempts and payments.
            {isStripeConfigured() ? "" : " Stripe is not configured — only dealer-billed activation works."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" render={<Link href="/app/billing/plans" />}>
            Plans
          </Button>
          <Button size="sm" render={<Link href="/app/billing/new" />}>
            Start activation
          </Button>
        </div>
      </div>

      <Tabs defaultValue="entitlements">
        <TabsList className="flex-wrap">
          <TabsTrigger value="entitlements">Entitlements ({ents.total})</TabsTrigger>
          <TabsTrigger value="attempts">Activation attempts ({attempts.total})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments.total})</TabsTrigger>
        </TabsList>

        <TabsContent value="entitlements">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Devices</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ents.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground text-center">
                      No entitlements yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  ents.rows.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        <Link href={`/app/billing/${e.id}`} className="hover:underline">
                          {e.planName ?? e.planCode ?? `#${e.planId}`}
                        </Link>
                      </TableCell>
                      <TableCell>{e.userName ?? e.ownerXnid ?? "—"}</TableCell>
                      <TableCell>{e.billingMode}</TableCell>
                      <TableCell>{e.source}</TableCell>
                      <TableCell>
                        {e.activeDeviceCount}
                        {e.maxDevicesAllowed === -1 ? " / ∞" : e.maxDevicesAllowed != null ? ` / ${e.maxDevicesAllowed}` : ""}
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.status === "active" ? "secondary" : "outline"}>{e.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="attempts">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Devices</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground text-center">
                      No activation attempts yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  attempts.rows.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.email}</TableCell>
                      <TableCell>{a.planCode ?? "—"}</TableCell>
                      <TableCell>{a.deviceCount}</TableCell>
                      <TableCell>{a.billingMode}</TableCell>
                      <TableCell>
                        <Badge variant={a.status === "completed" ? "secondary" : "outline"}>{a.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(a.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice / intent</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Card</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground text-center">
                      No payments yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.rows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.providerInvoiceId ?? "—"}</TableCell>
                      <TableCell>{p.paymentProvider}</TableCell>
                      <TableCell>{p.paymentMethod ?? "—"}</TableCell>
                      <TableCell>
                        {p.cardBrand ? `${p.cardBrand} ···· ${p.cardLast4 ?? ""}` : "—"}
                      </TableCell>
                      <TableCell>${p.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
