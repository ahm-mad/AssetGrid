"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  saveRatePlan,
  deleteRatePlan,
  calculateQuote,
  generateQuote,
  createReservation,
  confirmReservation,
  updateReservation,
  type QuoteCalculation,
  type GeneratedQuotePayload,
} from "@/lib/marina/pms/actions";
import {
  sendContract,
  signContract,
  billContract,
  terminateContract,
} from "@/lib/marina/pms/contract-actions";
import { markInvoicePaid, voidInvoice } from "@/lib/marina/pms/billing-actions";
import type { RatePlanRow, ReservationRow } from "@/lib/marina/pms/data";
import type { ContractRow } from "@/lib/marina/pms/contracts-data";
import type { InvoiceRow } from "@/lib/marina/pms/billing-data";
import type { RevenueReport, OccupancyReport, ArSummaryReport } from "@/lib/marina/pms/reports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Pickers = {
  docks: { id: number; name: string }[];
  boats: { id: number; name: string; loa: number | null; dockId: number | null }[];
};

const OPERATORS = [">=", "<=", ">", "<", "=", "between"] as const;
const CALC_TYPES = ["nightly", "monthly"] as const;

function money(n: number | null | undefined): string {
  return n == null ? "—" : `$${Number(n).toFixed(2)}`;
}

export function PmsHub({
  marinaId,
  canWrite,
  canDelete,
  ratePlans,
  reservations,
  contracts,
  invoices,
  arAging,
  revenue,
  occupancy,
  arSummary,
  pickers,
  ratePlanOptions,
  users,
}: {
  marinaId: number;
  canWrite: boolean;
  canDelete: boolean;
  ratePlans: RatePlanRow[];
  reservations: ReservationRow[];
  contracts: ContractRow[];
  invoices: InvoiceRow[];
  arAging: Record<"0-30" | "31-60" | "61-90" | "90+", number>;
  revenue: RevenueReport;
  occupancy: OccupancyReport;
  arSummary: ArSummaryReport;
  pickers: Pickers;
  ratePlanOptions: { id: number; name: string; calcType: string | null }[];
  users: { id: string; name: string }[];
}) {
  return (
    <Tabs defaultValue="book">
      <TabsList>
        <TabsTrigger value="book">Quote &amp; book</TabsTrigger>
        <TabsTrigger value="reservations">Reservations ({reservations.length})</TabsTrigger>
        <TabsTrigger value="contracts">Contracts ({contracts.length})</TabsTrigger>
        <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>
        <TabsTrigger value="reports">Reports</TabsTrigger>
        <TabsTrigger value="plans">Rate plans ({ratePlans.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="book">
        <QuoteCalculator
          marinaId={marinaId}
          canWrite={canWrite}
          pickers={pickers}
          ratePlanOptions={ratePlanOptions}
          users={users}
        />
      </TabsContent>

      <TabsContent value="reservations">
        <ReservationsTable marinaId={marinaId} canWrite={canWrite} reservations={reservations} />
      </TabsContent>

      <TabsContent value="contracts">
        <ContractsTable marinaId={marinaId} canWrite={canWrite} contracts={contracts} />
      </TabsContent>

      <TabsContent value="invoices">
        <InvoicesTable marinaId={marinaId} canWrite={canWrite} invoices={invoices} arAging={arAging} />
      </TabsContent>

      <TabsContent value="reports">
        <Reports revenue={revenue} occupancy={occupancy} arSummary={arSummary} />
      </TabsContent>

      <TabsContent value="plans">
        <RatePlans
          marinaId={marinaId}
          canWrite={canWrite}
          canDelete={canDelete}
          ratePlans={ratePlans}
        />
      </TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// Quote calculator + reservation booking
// ---------------------------------------------------------------------------
function QuoteCalculator({
  marinaId,
  canWrite,
  pickers,
  ratePlanOptions,
  users,
}: {
  marinaId: number;
  canWrite: boolean;
  pickers: Pickers;
  ratePlanOptions: { id: number; name: string; calcType: string | null }[];
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [dockId, setDockId] = React.useState<string>("");
  const [boatId, setBoatId] = React.useState<string>("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [ratePlanId, setRatePlanId] = React.useState<string>("auto");
  const [loa, setLoa] = React.useState("");
  const [discount, setDiscount] = React.useState("");
  const [discountType, setDiscountType] = React.useState<"none" | "percent" | "fixed">("none");
  const [surcharge, setSurcharge] = React.useState("");
  const [userId, setUserId] = React.useState("");
  const [slipId, setSlipId] = React.useState("");
  const [calc, setCalc] = React.useState<QuoteCalculation | null>(null);
  const [generated, setGenerated] = React.useState<GeneratedQuotePayload | null>(null);

  function payload() {
    return {
      dock_id: Number(dockId),
      boat_id: Number(boatId),
      start_date: startDate,
      end_date: endDate,
      rate_plan_id: ratePlanId === "auto" ? null : Number(ratePlanId),
      loa: loa ? Number(loa) : null,
      slip_id: slipId ? Number(slipId) : null,
      discount: discount ? Number(discount) : null,
      discount_type: discountType === "none" ? null : discountType,
      surcharge: surcharge ? Number(surcharge) : null,
    };
  }

  function onCalculate() {
    setGenerated(null);
    start(async () => {
      const res = await calculateQuote(payload());
      if (!res.ok || !res.data) {
        toast.error(res.error ?? "Could not calculate the quote.");
        setCalc(null);
        return;
      }
      setCalc(res.data);
    });
  }

  function onGenerate() {
    start(async () => {
      const res = await generateQuote(payload());
      if (!res.ok || !res.data) {
        toast.error(res.error ?? "Could not generate the quote.");
        return;
      }
      setGenerated(res.data);
      toast.success("Quote ready — pick a customer and create the reservation.");
    });
  }

  function onBook() {
    if (!generated) return;
    if (!userId) {
      toast.error("Choose a customer for the reservation.");
      return;
    }
    start(async () => {
      const res = await createReservation({
        dock_id: generated.reservationPayload.dockId,
        boat_id: generated.reservationPayload.boatId,
        slip_id: generated.reservationPayload.slipId,
        marina_id: generated.reservationPayload.marinaId,
        user_id: userId,
        quote_payload: generated.quotePayload,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Could not create the reservation.");
        return;
      }
      toast.success("Reservation created.");
      router.push(`/app/marina/${marinaId}/pms/reservations/${res.data?.id}`);
      router.refresh();
    });
  }

  const p = calc?.pricing;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid gap-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Inputs</h2>
        <Field label="Dock">
          <Select value={dockId} onValueChange={(v) => setDockId(v ?? "")}>
            <SelectTrigger><SelectValue placeholder="Select a dock" /></SelectTrigger>
            <SelectContent>
              {pickers.docks.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Boat">
          <Select
            value={boatId}
            onValueChange={(v) => {
              setBoatId(v ?? "");
              const b = pickers.boats.find((x) => String(x.id) === v);
              if (b?.loa != null) setLoa(String(b.loa));
              if (b?.dockId != null) setDockId(String(b.dockId));
            }}
          >
            <SelectTrigger><SelectValue placeholder="Select a boat" /></SelectTrigger>
            <SelectContent>
              {pickers.boats.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}{b.loa != null ? ` · ${b.loa}ft` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="End date">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rate plan">
            <Select value={ratePlanId} onValueChange={(v) => setRatePlanId(v ?? "auto")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-resolve by LOA</SelectItem>
                {ratePlanOptions.map((rp) => (
                  <SelectItem key={rp.id} value={String(rp.id)}>{rp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="LOA (ft)">
            <Input type="number" value={loa} onChange={(e) => setLoa(e.target.value)} placeholder="from boat" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Discount">
            <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </Field>
          <Field label="Type">
            <Select value={discountType} onValueChange={(v) => setDiscountType((v as "none" | "percent" | "fixed") ?? "none")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="percent">percent</SelectItem>
                <SelectItem value="fixed">fixed</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Surcharge">
            <Input type="number" value={surcharge} onChange={(e) => setSurcharge(e.target.value)} />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCalculate} disabled={pending || !dockId || !boatId || !startDate || !endDate}>
            Calculate
          </Button>
          {canWrite ? (
            <Button size="sm" onClick={onGenerate} disabled={pending || !dockId || !boatId || !startDate || !endDate}>
              Generate quote
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Pricing</h2>
        {!p ? (
          <p className="text-muted-foreground text-sm">Run a calculation to see the breakdown.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <Stat label="Rate plan" value={calc?.ratePlan.name ?? "—"} />
            <Stat label="Calc type" value={p.calc_type ?? "—"} />
            <Stat label="Days" value={String(p.days)} />
            <Stat label="Nightly" value={money(p.nightly_total)} />
            <Stat label="Subtotal" value={money(p.subtotal)} />
            <Stat label="Discount" value={money(p.discountAmount)} />
            <Stat label="Surcharge" value={money(p.surchargeAmount)} />
            <Stat label="Tax (8%)" value={money(p.finalTax ?? p.tax)} />
            <Stat label="Total" value={money(p.finalTotal ?? p.total)} />
            <Stat label="Slips free" value={`${calc?.availableSlips ?? 0}`} />
          </dl>
        )}

        {generated ? (
          <div className="grid gap-2 border-t pt-3">
            <p className="text-sm font-medium">Create reservation</p>
            <Field label="Customer">
              <Select value={userId} onValueChange={(v) => setUserId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Select a customer" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button size="sm" onClick={onBook} disabled={pending || !userId}>
              Create reservation ({money(generated.quotePayload.total)})
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------
function ReservationsTable({
  marinaId,
  canWrite,
  reservations,
}: {
  marinaId: number;
  canWrite: boolean;
  reservations: ReservationRow[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Action failed.");
      else {
        toast.success("Done.");
        router.refresh();
      }
    });
  }

  if (reservations.length === 0) {
    return <p className="text-muted-foreground text-sm">No reservations yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Boat</TableHead>
          <TableHead>Dock</TableHead>
          <TableHead>Dates</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Assign</TableHead>
          <TableHead>Total</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {reservations.map((r) => (
          <TableRow key={r.id}>
            <TableCell>{r.id}</TableCell>
            <TableCell>{r.boatName ?? "—"}</TableCell>
            <TableCell>{r.dockName ?? "—"}</TableCell>
            <TableCell className="text-xs">
              {r.startDate} → {r.endDate}
            </TableCell>
            <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
            <TableCell className="text-xs">{r.assignmentStatus ?? "unassigned"}</TableCell>
            <TableCell>{money(r.total)}</TableCell>
            <TableCell className="flex gap-1">
              {canWrite && r.status === "pending" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => act(() => confirmReservation(r.id, marinaId))}
                >
                  Confirm
                </Button>
              ) : null}
              {canWrite && !["cancelled", "expired", "completed"].includes(r.status) ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    act(() =>
                      updateReservation({ id: r.id, marina_id: marinaId, status: "cancelled" }),
                    )
                  }
                >
                  Cancel
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                render={<Link href={`/app/marina/${marinaId}/pms/reservations/${r.id}`} />}
              >
                Open
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------
function ContractsTable({
  marinaId,
  canWrite,
  contracts,
}: {
  marinaId: number;
  canWrite: boolean;
  contracts: ContractRow[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg = "Done.") {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Action failed.");
      else {
        toast.success(okMsg);
        router.refresh();
      }
    });
  }

  if (contracts.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No contracts. Generate one from a reservation with an assigned slip.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Boat</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Slip</TableHead>
          <TableHead>Monthly</TableHead>
          <TableHead>Status</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {contracts.map((c) => (
          <TableRow key={c.id}>
            <TableCell>{c.id}</TableCell>
            <TableCell>{c.boatName ?? "—"}</TableCell>
            <TableCell>{c.customerName ?? "—"}</TableCell>
            <TableCell>{c.slipName ?? "—"}</TableCell>
            <TableCell>{money(c.monthlyRate)}</TableCell>
            <TableCell><Badge variant="secondary">{c.status}</Badge></TableCell>
            <TableCell className="flex flex-wrap gap-1">
              {c.pdfUrl ? (
                <Button size="sm" variant="ghost" render={<Link href={c.pdfUrl} target="_blank" />}>
                  PDF
                </Button>
              ) : null}
              {canWrite && ["required", "sent"].includes(c.status) ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => act(() => sendContract(c.id), "Sent — signing link created.")}
                >
                  Send
                </Button>
              ) : null}
              {canWrite && ["required", "sent"].includes(c.status) ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => act(() => signContract(c.id), "Signed.")}
                >
                  Sign now
                </Button>
              ) : null}
              {canWrite && ["signed", "active"].includes(c.status) ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => act(() => billContract(c.id, marinaId), "Invoice created.")}
                >
                  Bill
                </Button>
              ) : null}
              {canWrite && !["terminated", "expired"].includes(c.status) ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    act(
                      () =>
                        terminateContract({
                          contractId: c.id,
                          marinaId,
                          reason: "Terminated by marina staff",
                          terminationDate: new Date(Date.now() + 86400000)
                            .toISOString()
                            .slice(0, 10),
                        }),
                      "Terminated.",
                    )
                  }
                >
                  Terminate
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------
function InvoicesTable({
  marinaId,
  canWrite,
  invoices,
  arAging,
}: {
  marinaId: number;
  canWrite: boolean;
  invoices: InvoiceRow[];
  arAging: Record<"0-30" | "31-60" | "61-90" | "90+", number>;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg = "Done.") {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Action failed.");
      else {
        toast.success(okMsg);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["0-30", "31-60", "61-90", "90+"] as const).map((k) => (
          <div key={k} className="rounded-lg border p-3">
            <dt className="text-muted-foreground text-xs">AR {k} days</dt>
            <dd className="font-medium">{money(arAging[k])}</dd>
          </div>
        ))}
      </dl>

      {invoices.length === 0 ? (
        <p className="text-muted-foreground text-sm">No invoices. Bill a signed contract to create one.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>For</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell>{inv.id}</TableCell>
                <TableCell className="text-xs">
                  {inv.billableType} #{inv.billableId}
                </TableCell>
                <TableCell>{money(inv.amount)}</TableCell>
                <TableCell><Badge variant="secondary">{inv.status}</Badge></TableCell>
                <TableCell className="text-xs">
                  {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="flex gap-1">
                  {canWrite && !["paid", "void"].includes(inv.status) ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => act(() => markInvoicePaid(inv.id, marinaId), "Marked paid.")}
                      >
                        Mark paid
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => act(() => voidInvoice(inv.id, marinaId), "Voided.")}
                      >
                        Void
                      </Button>
                    </>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
function Reports({
  revenue,
  occupancy,
  arSummary,
}: {
  revenue: RevenueReport;
  occupancy: OccupancyReport;
  arSummary: ArSummaryReport;
}) {
  return (
    <div className="grid gap-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold">Revenue this month — per dock</h2>
        {revenue.perDock.length === 0 ? (
          <p className="text-muted-foreground text-sm">No reservation revenue this month.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dock</TableHead>
                <TableHead>Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenue.perDock.map((d) => (
                <TableRow key={d.dockId}>
                  <TableCell>{d.dockName}</TableCell>
                  <TableCell>{money(d.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Occupancy this month — per dock</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dock</TableHead>
              <TableHead>Occupancy</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {occupancy.perDock.map((d) => (
              <TableRow key={d.dockId}>
                <TableCell>{d.dockName}</TableCell>
                <TableCell>{d.occupancyPercent}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">AR summary — per company</h2>
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rate plans
// ---------------------------------------------------------------------------
function RatePlans({
  marinaId,
  canWrite,
  canDelete,
  ratePlans,
}: {
  marinaId: number;
  canWrite: boolean;
  canDelete: boolean;
  ratePlans: RatePlanRow[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [name, setName] = React.useState("");
  const [calcType, setCalcType] = React.useState<string>("nightly");
  const [rate, setRate] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [loaUnit, setLoaUnit] = React.useState("ft");
  const [op, setOp] = React.useState<string>(">=");
  const [v1, setV1] = React.useState("");
  const [v2, setV2] = React.useState("");

  function onCreate() {
    start(async () => {
      const res = await saveRatePlan({
        marina_id: marinaId,
        name,
        calc_type: calcType,
        rate: Number(rate),
        start_date: startDate || null,
        end_date: endDate || null,
        loa_unit: loaUnit,
        condition: [
          {
            loa_operator: op,
            loa_value_1: Number(v1),
            loa_value_2: op === "between" && v2 ? Number(v2) : null,
          },
        ],
      });
      if (!res.ok) {
        toast.error(res.error ?? "Could not save the rate plan.");
        return;
      }
      toast.success("Rate plan created.");
      setName("");
      setRate("");
      setV1("");
      setV2("");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      {canWrite ? (
        <div className="grid gap-3 rounded-lg border p-4">
          <h2 className="text-sm font-semibold">New rate plan</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Calc type">
              <Select value={calcType} onValueChange={(v) => setCalcType(v ?? "nightly")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CALC_TYPES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={calcType === "monthly" ? "Monthly rate" : "Nightly rate"}>
              <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
            </Field>
            <Field label="LOA unit">
              <Input value={loaUnit} onChange={(e) => setLoaUnit(e.target.value)} />
            </Field>
            <Field label="Active from">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Active to">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="LOA operator">
              <Select value={op} onValueChange={(v) => setOp(v ?? ">=")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Value 1">
              <Input type="number" value={v1} onChange={(e) => setV1(e.target.value)} />
            </Field>
            <Field label="Value 2 (between)">
              <Input type="number" value={v2} onChange={(e) => setV2(e.target.value)} disabled={op !== "between"} />
            </Field>
          </div>
          <Button size="sm" onClick={onCreate} disabled={pending || !name || !rate || !v1}>
            Create rate plan
          </Button>
        </div>
      ) : null}

      {ratePlans.length === 0 ? (
        <p className="text-muted-foreground text-sm">No rate plans yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Calc</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Conditions</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ratePlans.map((rp) => (
              <TableRow key={rp.id}>
                <TableCell>{rp.name}</TableCell>
                <TableCell>{rp.calcType}</TableCell>
                <TableCell>{money(rp.rate)}</TableCell>
                <TableCell className="text-xs">
                  {rp.startDate ?? "—"} → {rp.endDate ?? "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {Array.isArray(rp.condition)
                    ? (rp.condition as { loa_operator?: string; loa_value_1?: number }[])
                        .map((c) => `${c.loa_operator ?? ""} ${c.loa_value_1 ?? ""}`)
                        .join(", ")
                    : "—"}
                </TableCell>
                <TableCell>
                  {canDelete ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const res = await deleteRatePlan(rp.id, marinaId);
                          if (!res.ok) toast.error(res.error ?? "Could not delete.");
                          else {
                            toast.success("Deleted.");
                            router.refresh();
                          }
                        })
                      }
                    >
                      Delete
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
