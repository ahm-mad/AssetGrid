"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { saveAlertWindow, deleteAlertWindow } from "@/lib/messaging/actions";
import type { AlertWindowRow } from "@/lib/messaging/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ATTRS = ["temperature", "humidity", "external_input", "move", "reed_state", "voltage"];

export function AlertWindowsTab({
  rows,
  inventoryDevices,
  canWrite,
}: {
  rows: AlertWindowRow[];
  inventoryDevices: { id: number; label: string }[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AlertWindowRow | null>(null);
  const [attrKey, setAttrKey] = React.useState("temperature");
  const [recurrence, setRecurrence] = React.useState("weekly");
  const [days, setDays] = React.useState<string[]>([]);
  const [invIds, setInvIds] = React.useState<number[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  function openNew() {
    setEditing(null);
    setAttrKey("temperature");
    setRecurrence("weekly");
    setDays([]);
    setInvIds([]);
    setErr(null);
    setOpen(true);
  }
  function openEdit(w: AlertWindowRow) {
    setEditing(w);
    setAttrKey(w.attributeKey);
    setRecurrence(w.recurrence);
    setDays(w.days);
    setInvIds(w.inventories.map((i) => Number(i.value)).filter((n) => !Number.isNaN(n)));
    setErr(null);
    setOpen(true);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    start(async () => {
      const res = await saveAlertWindow({
        id: editing?.id,
        rule_name: fd.get("rule_name"),
        attribute_key: attrKey,
        recurrence,
        days,
        inventories: invIds.map((id) => ({
          value: String(id),
          label: inventoryDevices.find((d) => d.id === id)?.label ?? String(id),
        })),
        start_time: fd.get("start_time"),
        end_time: fd.get("end_time"),
        timezone: fd.get("timezone") || "UTC",
      });
      if (res.ok) {
        toast.success("Saved");
        setOpen(false);
        router.refresh();
      } else setErr(res.error ?? "Could not save");
    });
  }

  return (
    <div className="grid gap-3">
      <p className="text-muted-foreground text-sm">
        Suppress alerts for a signal on the selected devices during the window (days + time).
      </p>
      {canWrite ? (
        <div>
          <Button size="sm" onClick={openNew}>
            New window
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Signal</TableHead>
              <TableHead>Window</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Devices</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground text-center">
                  No windows.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.attributeKey}</TableCell>
                  <TableCell>
                    {w.startTime.slice(0, 5)}–{w.endTime.slice(0, 5)}{" "}
                    <span className="text-muted-foreground">{w.timezone}</span>
                  </TableCell>
                  <TableCell>{w.days.join(", ") || "all"}</TableCell>
                  <TableCell>{w.inventories.length}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {canWrite ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(w)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const res = await deleteAlertWindow(w.id);
                              if (res.ok) router.refresh();
                              else toast.error(res.error ?? "Failed");
                            })
                          }
                        >
                          Delete
                        </Button>
                      </>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit window" : "New window"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="rule_name">Name</Label>
              <Input id="rule_name" name="rule_name" defaultValue={editing?.ruleName ?? ""} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Signal</Label>
                <Select value={attrKey} onValueChange={(v) => setAttrKey(v ?? "temperature")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ATTRS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Recurrence</Label>
                <Select value={recurrence} onValueChange={(v) => setRecurrence(v ?? "weekly")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["daily", "weekly", "bi-weekly"].map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="start_time">Start</Label>
                <Input id="start_time" name="start_time" type="time" defaultValue={editing?.startTime.slice(0, 5) ?? "22:00"} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end_time">End</Label>
                <Input id="end_time" name="end_time" type="time" defaultValue={editing?.endTime.slice(0, 5) ?? "07:00"} />
              </div>
              <div className="col-span-2 grid gap-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  name="timezone"
                  defaultValue={editing?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Days (empty = every day)</Label>
              <div className="flex flex-wrap gap-3">
                {DAYS.map((d) => (
                  <label key={d} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={days.includes(d)}
                      onCheckedChange={() =>
                        setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]))
                      }
                    />
                    {d}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Devices</Label>
              <div className="max-h-32 overflow-y-auto rounded-md border p-2">
                {inventoryDevices.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 py-0.5 text-sm">
                    <Checkbox
                      checked={invIds.includes(d.id)}
                      onCheckedChange={() =>
                        setInvIds((p) => (p.includes(d.id) ? p.filter((x) => x !== d.id) : [...p, d.id]))
                      }
                    />
                    {d.label}
                  </label>
                ))}
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
