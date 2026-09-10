"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { savePlan, deletePlan, togglePlanActive, syncPlanFromStripe } from "@/lib/billing/plans";
import type { PlanRow } from "@/lib/billing/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MODES = ["direct", "dealer_assisted", "dealer_billed"] as const;

export function PlansClient({
  rows,
  stripeConfigured,
  canCreate,
  canEdit,
  canDelete,
}: {
  rows: PlanRow[];
  stripeConfigured: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PlanRow | null>(null);
  const [family, setFamily] = React.useState("consumer");
  const [billingType, setBillingType] = React.useState("one_time");
  const [interval, setInterval] = React.useState("month");
  const [modes, setModes] = React.useState<string[]>(["direct"]);
  const [err, setErr] = React.useState<string | null>(null);

  function openNew() {
    setEditing(null);
    setFamily("consumer");
    setBillingType("one_time");
    setInterval("month");
    setModes(["direct"]);
    setErr(null);
    setOpen(true);
  }
  function openEdit(p: PlanRow) {
    setEditing(p);
    setFamily(p.planFamily);
    setBillingType(p.billingType);
    setInterval(p.billingInterval ?? "month");
    setModes(p.billingModes.length ? p.billingModes : ["direct"]);
    setErr(null);
    setOpen(true);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    start(async () => {
      const res = await savePlan({
        id: editing?.id,
        plan_code: fd.get("plan_code"),
        name: fd.get("name"),
        plan_family: family,
        device_limit: fd.get("device_limit"),
        amount: fd.get("amount"),
        billing_type: billingType,
        billing_interval: billingType === "one_time" ? null : interval,
        billing_modes: modes,
        activation_type: fd.get("activation_type") || "Single",
        requires_provisioning: fd.get("requires_provisioning") === "on",
        provisioning_amount: fd.get("provisioning_amount") || null,
        max_devices_per_batch: fd.get("max_devices_per_batch") || null,
        tags: fd.get("tags"),
        notes: fd.get("notes"),
      });
      if (res.ok) {
        toast.success(res.warning ?? (editing ? "Saved" : "Plan created"));
        setOpen(false);
        router.refresh();
      } else {
        setErr(res.error ?? (res.fieldErrors ? "Check the fields." : "Could not save"));
      }
    });
  }

  return (
    <div className="grid gap-3">
      {canCreate ? (
        <div>
          <Button size="sm" onClick={openNew}>
            New plan
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Family</TableHead>
              <TableHead>Device limit</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Stripe</TableHead>
              <TableHead>Active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground text-center">
                  No plans yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => (
                <TableRow key={p.id} className={p.deletedAt ? "opacity-50" : undefined}>
                  <TableCell className="font-mono text-xs">{p.planCode}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.planFamily}</TableCell>
                  <TableCell>{p.deviceLimit === -1 ? "∞" : p.deviceLimit}</TableCell>
                  <TableCell>
                    {p.amount != null ? `$${p.amount.toFixed(2)}` : "—"}
                    {p.billingInterval ? `/${p.billingInterval}` : ""}
                  </TableCell>
                  <TableCell>{p.billingType}</TableCell>
                  <TableCell>{p.stripePriceId ? "linked" : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={p.isActive ? "secondary" : "outline"}>
                      {p.isActive ? "active" : "inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {canEdit ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const res = await togglePlanActive(p.id, !p.isActive);
                              if (res.ok) router.refresh();
                              else toast.error(res.error ?? "Failed");
                            })
                          }
                        >
                          {p.isActive ? "Disable" : "Enable"}
                        </Button>
                        {stripeConfigured && p.stripeProductId ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() =>
                              start(async () => {
                                const res = await syncPlanFromStripe(p.id);
                                if (res.ok) {
                                  toast.success("Synced from Stripe");
                                  router.refresh();
                                } else toast.error(res.error ?? "Failed");
                              })
                            }
                          >
                            Sync
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                    {canDelete && !p.deletedAt ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const res = await deletePlan(p.id);
                            if (res.ok) router.refresh();
                            else toast.error(res.error ?? "Failed");
                          })
                        }
                      >
                        Delete
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.planCode}` : "New plan"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="plan_code">Plan code *</Label>
                <Input
                  id="plan_code"
                  name="plan_code"
                  defaultValue={editing?.planCode ?? ""}
                  disabled={!!editing}
                  className="font-mono"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" defaultValue={editing?.name ?? ""} />
              </div>
              <div className="grid gap-2">
                <Label>Family</Label>
                <Select value={family} onValueChange={(v) => setFamily(v ?? "consumer")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["consumer", "operator", "hybrid"].map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="device_limit">Device limit (-1 = ∞)</Label>
                <Input
                  id="device_limit"
                  name="device_limit"
                  type="number"
                  defaultValue={editing?.deviceLimit ?? 1}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input id="amount" name="amount" type="number" step="0.01" min={0} defaultValue={editing?.amount ?? 0} />
              </div>
              <div className="grid gap-2">
                <Label>Billing type</Label>
                <Select
                  value={billingType}
                  onValueChange={(v) => setBillingType(v ?? "one_time")}
                >
                  <SelectTrigger disabled={!!editing}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["one_time", "recurring", "hybrid"].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {billingType !== "one_time" ? (
                <div className="grid gap-2">
                  <Label>Interval</Label>
                  <Select value={interval} onValueChange={(v) => setInterval(v ?? "month")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">month</SelectItem>
                      <SelectItem value="year">year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {billingType === "hybrid" ? (
                <div className="grid gap-2">
                  <Label htmlFor="provisioning_amount">Provisioning amount</Label>
                  <Input id="provisioning_amount" name="provisioning_amount" type="number" step="0.01" min={0} />
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="activation_type">Activation type</Label>
                <Input id="activation_type" name="activation_type" defaultValue={editing?.activationType ?? "Single"} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="max_devices_per_batch">Max devices / batch</Label>
                <Input
                  id="max_devices_per_batch"
                  name="max_devices_per_batch"
                  type="number"
                  min={1}
                  defaultValue={editing?.maxDevicesPerBatch ?? ""}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Billing modes *</Label>
              <div className="flex flex-wrap gap-3">
                {MODES.map((m) => (
                  <label key={m} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={modes.includes(m)}
                      onCheckedChange={() =>
                        setModes((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]))
                      }
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="requires_provisioning" defaultChecked={editing?.requiresProvisioning ?? false} />
              Requires provisioning
            </label>

            <div className="grid gap-2">
              <Label htmlFor="tags">Tags</Label>
              <Input id="tags" name="tags" defaultValue={editing?.tags ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" defaultValue={editing?.notes ?? ""} />
            </div>

            {err ? <p className="text-destructive text-sm">{err}</p> : null}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
