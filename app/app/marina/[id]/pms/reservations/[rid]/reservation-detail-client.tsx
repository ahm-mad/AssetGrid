"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  toggleAssignment,
  updateReservation,
  confirmReservation,
} from "@/lib/marina/pms/actions";
import {
  generateContract,
  sendContract,
  signContract,
} from "@/lib/marina/pms/contract-actions";
import type { ReservationDetail } from "@/lib/marina/pms/data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Slip = {
  id: number;
  name: string;
  dockId: number | null;
  minLoa: number | null;
  maxLoa: number | null;
  isActive: boolean;
};

const NEXT_STATUS: Record<string, string[]> = {
  draft: ["pending", "cancelled"],
  pending: ["confirmed", "waitlisted", "cancelled", "expired"],
  hold: ["pending", "cancelled", "expired"],
  confirmed: ["contract_required", "waitlisted", "cancelled", "completed"],
  contract_required: ["contract_signed", "cancelled", "expired"],
  contract_signed: ["active", "cancelled"],
  active: ["completed", "cancelled"],
  waitlisted: ["confirmed", "cancelled", "expired"],
  cancelled: ["confirmed"],
  expired: [],
  completed: [],
};

function money(n: number | null | undefined): string {
  return n == null ? "—" : `$${Number(n).toFixed(2)}`;
}

export function ReservationDetailClient({
  marinaId,
  canWrite,
  reservation,
  slips,
}: {
  marinaId: number;
  canWrite: boolean;
  reservation: ReservationDetail;
  slips: Slip[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [slipId, setSlipId] = React.useState<string>(
    reservation.assignment?.slipId ? String(reservation.assignment.slipId) : "",
  );

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg = "Done.") {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Action failed.");
      else {
        toast.success(okMsg);
        router.refresh();
      }
    });
  }

  const eligibleSlips = slips.filter(
    (s) =>
      s.isActive &&
      (reservation.loa == null ||
        ((s.minLoa == null || s.minLoa <= reservation.loa) &&
          (s.maxLoa == null || s.maxLoa >= reservation.loa))),
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <Row label="Status" value={<Badge variant="secondary">{reservation.status}</Badge>} />
            <Row label="Boat" value={reservation.boatName ?? "—"} />
            <Row label="Dock" value={reservation.dockName ?? "—"} />
            <Row label="Rate plan" value={reservation.ratePlanName ?? "—"} />
            <Row label="Dates" value={`${reservation.startDate} → ${reservation.endDate}`} />
            <Row label="Days" value={String(reservation.days ?? "—")} />
            <Row label="LOA" value={reservation.loa != null ? `${reservation.loa} ft` : "—"} />
            <Row label="Subtotal" value={money(reservation.subtotal)} />
            <Row label="Tax" value={money(reservation.tax)} />
            <Row label="Total" value={money(reservation.total)} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assignment &amp; stay</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Assignment: </span>
            {reservation.assignment
              ? `${reservation.assignment.status}${
                  reservation.assignment.slipName ? ` · ${reservation.assignment.slipName}` : ""
                }`
              : "none"}
          </div>
          <div>
            <span className="text-muted-foreground">Stay: </span>
            {reservation.stay ? reservation.stay.status : "none"}
          </div>

          {canWrite ? (
            <div className="grid gap-2 border-t pt-3">
              <Label className="text-xs">Assign to slip</Label>
              <Select value={slipId} onValueChange={(v) => setSlipId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Select a slip" /></SelectTrigger>
                <SelectContent>
                  {eligibleSlips.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={pending || !slipId || !reservation.boatId}
                  onClick={() =>
                    run(
                      () =>
                        toggleAssignment({
                          reservation_id: reservation.id,
                          marina_id: marinaId,
                          action: "assigned",
                          boat_id: reservation.boatId ?? undefined,
                          slip_id: Number(slipId),
                          start_date: reservation.startDate ?? undefined,
                          end_date: reservation.endDate ?? undefined,
                        }),
                      "Slip assigned.",
                    )
                  }
                >
                  Assign
                </Button>
                {reservation.assignment && reservation.assignment.status !== "unassigned" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () =>
                          toggleAssignment({
                            reservation_id: reservation.id,
                            marina_id: marinaId,
                            action: "unassigned",
                          }),
                        "Unassigned.",
                      )
                    }
                  >
                    Unassign
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canWrite ? (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {reservation.status === "pending" ? (
              <Button
                size="sm"
                disabled={pending}
                onClick={() => run(() => confirmReservation(reservation.id, marinaId), "Confirmed.")}
              >
                Confirm (auto-assign)
              </Button>
            ) : null}
            {(NEXT_STATUS[reservation.status] ?? []).map((s) => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      updateReservation({
                        id: reservation.id,
                        marina_id: marinaId,
                        status: s,
                      }),
                    `Moved to ${s}.`,
                  )
                }
              >
                → {s}
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {canWrite || reservation.contracts.length > 0 ? (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Contracts</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {reservation.contracts.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{c.xnid}</span>
                <Badge variant="secondary">{c.status}</Badge>
                {canWrite && ["required", "sent"].includes(c.status) ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => run(() => sendContract(c.id), "Sent — signing link created.")}
                    >
                      Send
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => run(() => signContract(c.id), "Signed.")}
                    >
                      Sign now
                    </Button>
                  </>
                ) : null}
              </div>
            ))}
            {canWrite && reservation.assignment && reservation.assignment.status !== "unassigned" ? (
              <Button
                size="sm"
                disabled={pending}
                onClick={() => run(() => generateContract(reservation.id), "Contract generated.")}
              >
                Generate contract
              </Button>
            ) : reservation.contracts.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                Assign a slip first, then generate a contract.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {reservation.posTransactions.length > 0 ? (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">POS transactions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm">
            {reservation.posTransactions.map((t) => (
              <div key={t.id}>
                {t.serviceName} · {money(t.amount)} · {t.type}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
