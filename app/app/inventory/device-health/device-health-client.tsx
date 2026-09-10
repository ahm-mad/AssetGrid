"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  saveDeviceHealthScheduler,
  deleteDeviceHealthScheduler,
} from "@/lib/inventory/actions";
import type { DeviceHealthSchedulerRow } from "@/lib/inventory/data";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function DeviceHealthClient({
  rows,
  inventoryDevices,
}: {
  rows: DeviceHealthSchedulerRow[];
  inventoryDevices: { id: number; label: string }[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DeviceHealthSchedulerRow | null>(null);
  const [days, setDays] = React.useState<string[]>([]);
  const [devices, setDevices] = React.useState<number[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function openNew() {
    setEditing(null);
    setDays([]);
    setDevices([]);
    setErr(null);
    setOpen(true);
  }
  function openEdit(r: DeviceHealthSchedulerRow) {
    setEditing(r);
    setDays(r.days);
    setDevices(r.selectedDevices);
    setErr(null);
    setOpen(true);
  }

  function toggle<T>(list: T[], v: T): T[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    start(async () => {
      const res = await saveDeviceHealthScheduler({
        id: editing?.id,
        schedule_title: fd.get("schedule_title"),
        time_zone: fd.get("time_zone") || browserTz,
        time: fd.get("time"),
        days,
        selected_devices: devices,
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
      <div>
        <Button size="sm" onClick={openNew}>
          New scheduler
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Devices</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground text-center">
                  No schedulers yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.scheduleTitle}</TableCell>
                  <TableCell>
                    {r.time} <span className="text-muted-foreground">{r.timeZone}</span>
                  </TableCell>
                  <TableCell>{r.days.join(", ") || "—"}</TableCell>
                  <TableCell>{r.selectedDevices.length}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const res = await deleteDeviceHealthScheduler(r.id);
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit scheduler" : "New scheduler"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="schedule_title">Title *</Label>
              <Input id="schedule_title" name="schedule_title" defaultValue={editing?.scheduleTitle ?? ""} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="time">Time *</Label>
                <Input id="time" name="time" type="time" defaultValue={editing?.time ?? "09:00"} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="time_zone">Time zone</Label>
                <Input id="time_zone" name="time_zone" defaultValue={editing?.timeZone ?? browserTz} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Days</Label>
              <div className="flex flex-wrap gap-3">
                {DAYS.map((d) => (
                  <label key={d} className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={days.includes(d)} onCheckedChange={() => setDays((p) => toggle(p, d))} />
                    {d}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Devices</Label>
              <div className="max-h-40 overflow-y-auto rounded-md border p-2">
                {inventoryDevices.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No inventory devices.</p>
                ) : (
                  inventoryDevices.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 py-0.5 text-sm">
                      <Checkbox
                        checked={devices.includes(d.id)}
                        onCheckedChange={() => setDevices((p) => toggle(p, d.id))}
                      />
                      {d.label}
                    </label>
                  ))
                )}
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
