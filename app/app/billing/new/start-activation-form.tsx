"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { startCheckout } from "@/lib/billing/checkout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MODES = [
  { value: "direct", label: "Direct (Stripe checkout)" },
  { value: "dealer_assisted", label: "Dealer-assisted (Stripe checkout)" },
  { value: "dealer_billed", label: "Dealer-billed (completes immediately)" },
];

export function StartActivationForm({
  plans,
  users,
  selectedUserId,
  devices,
  stripeConfigured,
}: {
  plans: { id: number; label: string; hasStripePrice: boolean }[];
  users: { id: string; name: string; xnid: string | null }[];
  selectedUserId: string | null;
  devices: { id: number; xnid: string | null; deviceName: string | null; status: string }[];
  stripeConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [userId, setUserId] = React.useState(selectedUserId ?? "");
  const [planId, setPlanId] = React.useState("");
  const [mode, setMode] = React.useState("direct");
  const [picked, setPicked] = React.useState<number[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  function changeUser(v: string | null) {
    const next = v ?? "";
    setUserId(next);
    setPicked([]);
    router.push(next ? `/app/billing/new?user=${next}` : "/app/billing/new");
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    if (!userId || !planId || picked.length === 0) {
      setErr("Pick a user, a plan and at least one device.");
      return;
    }
    start(async () => {
      const res = await startCheckout({
        user_id: userId,
        plan_id: planId,
        user_device_ids: picked,
        billing_mode: mode,
        owner_xnid: fd.get("owner_xnid") || undefined,
        billing_xnid: fd.get("billing_xnid") || undefined,
        dealer_xnid: fd.get("dealer_xnid") || undefined,
      });
      if (res.ok) {
        if (res.checkoutUrl) {
          window.location.href = res.checkoutUrl;
        } else if (res.completed) {
          toast.success("Dealer-billed activation completed");
          router.push("/app/billing");
        } else {
          toast.success("Activation attempt created");
          router.push("/app/billing");
        }
      } else {
        setErr(res.error ?? (res.fieldErrors ? "Check the fields." : "Could not start activation"));
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-2">
        <Label>User *</Label>
        <Select value={userId} onValueChange={changeUser}>
          <SelectTrigger>
            <SelectValue placeholder="Select a user" />
          </SelectTrigger>
          <SelectContent>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label>Plan *</Label>
        <Select value={planId} onValueChange={(v) => setPlanId(v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="Select a plan" />
          </SelectTrigger>
          <SelectContent>
            {plans.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.label}
                {!p.hasStripePrice ? " — no Stripe price" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label>Billing mode *</Label>
        <Select value={mode} onValueChange={(v) => setMode(v ?? "direct")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODES.map((m) => (
              <SelectItem key={m.value} value={m.value} disabled={m.value !== "dealer_billed" && !stripeConfigured}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="owner_xnid">Owner xnid</Label>
          <Input id="owner_xnid" name="owner_xnid" className="font-mono text-xs" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="billing_xnid">Billing xnid</Label>
          <Input id="billing_xnid" name="billing_xnid" className="font-mono text-xs" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dealer_xnid">Dealer xnid</Label>
          <Input id="dealer_xnid" name="dealer_xnid" className="font-mono text-xs" />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Devices *</Label>
        {!userId ? (
          <p className="text-muted-foreground text-sm">Pick a user first.</p>
        ) : devices.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            This user has no devices pending activation.
          </p>
        ) : (
          <div className="rounded-md border p-2">
            {devices.map((d) => (
              <label key={d.id} className="flex items-center gap-2 py-0.5 text-sm">
                <Checkbox
                  checked={picked.includes(d.id)}
                  onCheckedChange={() =>
                    setPicked((p) => (p.includes(d.id) ? p.filter((x) => x !== d.id) : [...p, d.id]))
                  }
                />
                {d.deviceName ?? `#${d.id}`}{" "}
                <span className="text-muted-foreground font-mono text-xs">{d.xnid}</span>
                <span className="text-muted-foreground">· {d.status}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {err ? <p className="text-destructive text-sm">{err}</p> : null}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Working…" : mode === "dealer_billed" ? "Complete activation" : "Create checkout"}
        </Button>
      </div>
    </form>
  );
}
