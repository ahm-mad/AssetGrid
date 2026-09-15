import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/page-guards";
import {
  listEntitlements,
  listActivationAttempts,
  listPayments,
} from "@/lib/billing/data";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { UI_MOCK } from "@/lib/mock/enabled";
import { getMockBillingSummary } from "@/lib/mock/billing";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
import { StatusLabel, type StatusKind } from "@/components/charts/status-dot";

export const metadata = { title: "Billing" };

const ENT_STATUS: Record<string, StatusKind> = { active: "online", cancelled: "offline", pending: "warning" };
const ATTEMPT_STATUS: Record<string, StatusKind> = { completed: "online", pending: "warning", failed: "critical" };

export default async function BillingPage() {
  await requirePagePermission("commerce", "read", { allowCustomer: false });

  let activeCount: number;
  let totalPaid: number;
  let planChart: { label: string; value: number }[];
  let ents: Awaited<ReturnType<typeof listEntitlements>>;
  let attempts: Awaited<ReturnType<typeof listActivationAttempts>>;
  let payments: Awaited<ReturnType<typeof listPayments>>;
  let history: number[] | undefined;

  if (UI_MOCK) {
    const mock = getMockBillingSummary();
    activeCount = mock.activeCount;
    totalPaid = mock.totalCollected;
    planChart = mock.planChart;
    ents = mock.entitlements;
    attempts = mock.attempts;
    payments = mock.payments;
    history = mock.history;
  } else {
    [ents, attempts, payments] = await Promise.all([
      listEntitlements({ perPage: 50 }),
      listActivationAttempts({ perPage: 50 }),
      listPayments({ perPage: 50 }),
    ]);
    activeCount = ents.rows.filter((e) => e.status === "active").length;
    totalPaid = payments.rows.reduce((sum, p) => sum + p.amount, 0);
    const perPlan = new Map<string, number>();
    for (const e of ents.rows) {
      const name = e.planName ?? e.planCode ?? "Unknown";
      perPlan.set(name, (perPlan.get(name) ?? 0) + 1);
    }
    planChart = [...perPlan.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Billing</h1>
          <p className="text-muted-foreground text-sm">
            Entitlements, activation attempts and payments.
            {isStripeConfigured() || UI_MOCK ? "" : " Stripe is not configured — only dealer-billed activation works."}
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Active entitlements" value={activeCount} history={history} status="online" />
        <StatTile label="Activation attempts" value={attempts.total} status="info" />
        <StatTile label="Payments recorded" value={payments.total} status="info" />
        <StatTile label="Total collected ($)" value={Math.round(totalPaid)} status="online" />
      </div>

      {planChart.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entitlements by plan</CardTitle>
            <CardDescription>Active + historical, current page.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart data={planChart} color="var(--chart-2)" />
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="entitlements">
        <TabsList className="flex-wrap">
          <TabsTrigger value="entitlements">Entitlements ({ents.total})</TabsTrigger>
          <TabsTrigger value="attempts">Activation attempts ({attempts.total})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments.total})</TabsTrigger>
        </TabsList>

        <TabsContent value="entitlements">
          <Card className="overflow-hidden py-0">
            <div className="overflow-x-auto">
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
                          <Link href={`/app/billing/${e.id}`} className="hover:text-primary hover:underline">
                            {e.planName ?? e.planCode ?? `#${e.planId}`}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{e.userName ?? e.ownerXnid ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{e.billingMode}</TableCell>
                        <TableCell className="text-muted-foreground">{e.source}</TableCell>
                        <TableCell>
                          {e.activeDeviceCount}
                          {e.maxDevicesAllowed === -1 ? " / ∞" : e.maxDevicesAllowed != null ? ` / ${e.maxDevicesAllowed}` : ""}
                        </TableCell>
                        <TableCell>
                          <StatusLabel status={ENT_STATUS[e.status] ?? "offline"}>{e.status}</StatusLabel>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="attempts">
          <Card className="overflow-hidden py-0">
            <div className="overflow-x-auto">
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
                        <TableCell className="text-muted-foreground">{a.email}</TableCell>
                        <TableCell className="font-mono text-xs">{a.planCode ?? "—"}</TableCell>
                        <TableCell>{a.deviceCount}</TableCell>
                        <TableCell className="text-muted-foreground">{a.billingMode}</TableCell>
                        <TableCell>
                          <StatusLabel status={ATTEMPT_STATUS[a.status] ?? "offline"}>{a.status}</StatusLabel>
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
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="overflow-hidden py-0">
            <div className="overflow-x-auto">
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
                        <TableCell className="text-muted-foreground">{p.paymentProvider}</TableCell>
                        <TableCell className="text-muted-foreground">{p.paymentMethod ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.cardBrand ? `${p.cardBrand} ···· ${p.cardLast4 ?? ""}` : "—"}
                        </TableCell>
                        <TableCell className="font-mono">${p.amount.toFixed(2)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
