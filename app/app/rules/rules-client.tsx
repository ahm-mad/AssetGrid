"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  saveRule,
  deleteRule,
  bulkSetRuleActive,
  bulkDeleteRules,
} from "@/lib/rules/actions";
import type { RuleRow } from "@/lib/rules/data";
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

interface Options {
  devices: { userDeviceId: number; inventoryDeviceId: number; productId: number; label: string }[];
  attributes: string[];
}
const OPERATORS = [">", "<", ">=", "<=", "==", "!=", "-"] as const;
type Cond = { selectedAttribute: string; selectedCondition: string; conditionValue: string; logicalOperator: "AND" | "OR" };

export function RulesClient({
  rows,
  options,
  showOwner,
}: {
  rows: RuleRow[];
  options: Options;
  showOwner: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [selected, setSelected] = React.useState<number[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<RuleRow | null>(null);
  const [title, setTitle] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [deviceIds, setDeviceIds] = React.useState<number[]>([]);
  const [conds, setConds] = React.useState<Cond[]>([
    { selectedAttribute: options.attributes[0] ?? "temperature", selectedCondition: ">", conditionValue: "", logicalOperator: "AND" },
  ]);
  const [err, setErr] = React.useState<string | null>(null);

  function openNew() {
    setEditing(null);
    setTitle("");
    setActive(true);
    setDeviceIds([]);
    setConds([{ selectedAttribute: options.attributes[0] ?? "temperature", selectedCondition: ">", conditionValue: "", logicalOperator: "AND" }]);
    setErr(null);
    setOpen(true);
  }
  function openEdit(r: RuleRow) {
    setEditing(r);
    setTitle(r.title ?? "");
    setActive(r.isActive);
    setDeviceIds(r.devices.map((d) => d.user_device_id));
    setConds(
      r.conditions.map((c) => ({
        selectedAttribute: c.selectedAttribute ?? "",
        selectedCondition: c.selectedCondition ?? ">",
        conditionValue: String(c.conditionValue ?? ""),
        logicalOperator: (c.logicalOperator as "AND" | "OR") ?? "AND",
      })),
    );
    setErr(null);
    setOpen(true);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const devices = deviceIds
      .map((id) => options.devices.find((d) => d.userDeviceId === id))
      .filter(Boolean)
      .map((d) => ({
        product_id: d!.productId,
        user_device_id: d!.userDeviceId,
        inventory_device_id: d!.inventoryDeviceId,
      }));
    if (devices.length === 0) {
      setErr("Pick at least one device.");
      return;
    }
    start(async () => {
      const res = await saveRule({
        id: editing?.id,
        title,
        is_active: active,
        devices,
        conditions: conds,
      });
      if (res.ok) {
        toast.success(editing ? "Saved" : "Rule created");
        setOpen(false);
        router.refresh();
      } else setErr(res.error ?? (res.fieldErrors ? "Check the fields." : "Could not save"));
    });
  }

  const runBulk = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setSelected([]);
        router.refresh();
      } else toast.error(res.error ?? "Failed");
    });

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={openNew}>
          New rule
        </Button>
        {selected.length > 0 ? (
          <>
            <span className="text-muted-foreground text-sm">{selected.length} selected</span>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => runBulk(() => bulkSetRuleActive(selected, true))}>
              Enable
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => runBulk(() => bulkSetRuleActive(selected, false))}>
              Disable
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => runBulk(() => bulkDeleteRules(selected))}>
              Delete
            </Button>
          </>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Title</TableHead>
              {showOwner ? <TableHead>Owner</TableHead> : null}
              <TableHead>Devices</TableHead>
              <TableHead>Conditions</TableHead>
              <TableHead>Active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showOwner ? 7 : 6} className="text-muted-foreground text-center">
                  No rules yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(r.id)}
                      onCheckedChange={() =>
                        setSelected((p) => (p.includes(r.id) ? p.filter((x) => x !== r.id) : [...p, r.id]))
                      }
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <button className="hover:underline" onClick={() => openEdit(r)}>
                      {r.title ?? `Rule #${r.id}`}
                    </button>
                  </TableCell>
                  {showOwner ? <TableCell>{r.ownerName ?? "—"}</TableCell> : null}
                  <TableCell>{r.devices.length}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {r.conditions
                      .map((c) => `${c.selectedAttribute} ${c.selectedCondition} ${c.conditionValue}`)
                      .join(` ${r.conditions[0]?.logicalOperator ?? "AND"} `)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.isActive ? "secondary" : "outline"}>
                      {r.isActive ? "active" : "off"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const res = await deleteRule(r.id);
                          if (res.ok) router.refresh();
                          else toast.error(res.error ?? "Failed");
                        })
                      }
                    >
                      Delete
                    </Button>
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
            <DialogTitle>{editing ? `Edit ${editing.title}` : "New rule"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
            <div className="grid gap-2">
              <Label htmlFor="rt">Title *</Label>
              <Input id="rt" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={active} onCheckedChange={setActive} /> Active
            </label>

            <div className="grid gap-2">
              <Label>Devices *</Label>
              <div className="max-h-32 overflow-y-auto rounded-md border p-2">
                {options.devices.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No captured devices.</p>
                ) : (
                  options.devices.map((d) => (
                    <label key={d.userDeviceId} className="flex items-center gap-2 py-0.5 text-sm">
                      <Checkbox
                        checked={deviceIds.includes(d.userDeviceId)}
                        onCheckedChange={() =>
                          setDeviceIds((p) =>
                            p.includes(d.userDeviceId)
                              ? p.filter((x) => x !== d.userDeviceId)
                              : [...p, d.userDeviceId],
                          )
                        }
                      />
                      {d.label}
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Conditions *</Label>
              {conds.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                  <Select
                    value={c.selectedAttribute}
                    onValueChange={(v) =>
                      setConds((p) => p.map((x, j) => (j === i ? { ...x, selectedAttribute: v ?? "" } : x)))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.attributes.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={c.selectedCondition}
                    onValueChange={(v) =>
                      setConds((p) => p.map((x, j) => (j === i ? { ...x, selectedCondition: v ?? ">" } : x)))
                    }
                  >
                    <SelectTrigger className="w-16">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={c.conditionValue}
                    placeholder={c.selectedCondition === "-" ? "min-max" : "value"}
                    onChange={(e) =>
                      setConds((p) => p.map((x, j) => (j === i ? { ...x, conditionValue: e.target.value } : x)))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={conds.length === 1}
                    onClick={() => setConds((p) => p.filter((_, j) => j !== i))}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setConds((p) => [
                      ...p,
                      { selectedAttribute: options.attributes[0] ?? "temperature", selectedCondition: ">", conditionValue: "", logicalOperator: conds[0]?.logicalOperator ?? "AND" },
                    ])
                  }
                >
                  + condition
                </Button>
                {conds.length > 1 ? (
                  <Select
                    value={conds[0].logicalOperator}
                    onValueChange={(v) =>
                      setConds((p) => p.map((x) => ({ ...x, logicalOperator: (v as "AND" | "OR") ?? "AND" })))
                    }
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">AND</SelectItem>
                      <SelectItem value="OR">OR</SelectItem>
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
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
