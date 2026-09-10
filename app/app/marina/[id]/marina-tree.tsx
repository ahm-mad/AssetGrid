"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  saveDock,
  deleteDock,
  saveSlip,
  deleteSlip,
  saveBoat,
  deleteBoat,
  assignBoatToSlip,
} from "@/lib/marina/actions";
import type { MarinaTree as Tree, BoatNode } from "@/lib/marina/data";
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

export function MarinaTree({
  marina,
  canWrite,
  canDelete,
  inventoryDevices,
  users,
}: {
  marina: Tree;
  canWrite: boolean;
  canDelete: boolean;
  inventoryDevices: { id: number; label: string }[];
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [dockName, setDockName] = React.useState("");
  const [slipDock, setSlipDock] = React.useState<number | null>(null);
  const [slipName, setSlipName] = React.useState("");
  const [boatOpen, setBoatOpen] = React.useState(false);
  const [boatSlip, setBoatSlip] = React.useState<number | null>(null);
  const [boatDock, setBoatDock] = React.useState<number | null>(null);
  const [boatUser, setBoatUser] = React.useState("none");
  const [boatDevices, setBoatDevices] = React.useState<number[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  const refresh = () => router.refresh();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) refresh();
      else toast.error(res.error ?? "Failed");
    });

  function openBoatForm(opts: { slipId?: number | null; dockId?: number | null }) {
    setBoatSlip(opts.slipId ?? null);
    setBoatDock(opts.dockId ?? null);
    setBoatUser("none");
    setBoatDevices([]);
    setErr(null);
    setBoatOpen(true);
  }

  function submitBoat(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    start(async () => {
      const res = await saveBoat({
        marina_id: marina.id,
        dock_id: boatDock,
        slip_id: boatSlip,
        user_id: boatUser === "none" ? null : boatUser,
        boat_name: fd.get("boat_name"),
        boat_type: fd.get("boat_type"),
        boat_model: fd.get("boat_model"),
        storage_status: fd.get("storage_status") || "wet",
        inventory_device_ids: boatDevices,
        notification_email: fd.get("notification_email"),
        notification_number: fd.get("notification_number"),
      });
      if (res.ok) {
        setBoatOpen(false);
        refresh();
      } else setErr(res.error ?? "Could not save");
    });
  }

  const BoatLine = ({ b, slips }: { b: BoatNode; slips: { id: number; name: string }[] }) => (
    <li className="flex flex-wrap items-center justify-between gap-2">
      <span>
        ⛵ {b.boatName}
        {b.boatType ? <span className="text-muted-foreground"> · {b.boatType}</span> : null}
        {b.deviceCount ? (
          <Badge variant="secondary" className="ml-2">
            {b.deviceCount} dev
          </Badge>
        ) : null}
        {b.storageStatus ? <span className="text-muted-foreground text-xs"> · {b.storageStatus}</span> : null}
      </span>
      <span className="flex items-center gap-1">
        {canWrite ? (
          <Select
            value={b.slipId ? String(b.slipId) : "none"}
            onValueChange={(v) =>
              run(() => assignBoatToSlip(b.id, v === "none" ? null : Number(v), marina.id))
            }
          >
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="slip" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {slips.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {canDelete ? (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => deleteBoat(b.id, marina.id))}>
            Remove
          </Button>
        ) : null}
      </span>
    </li>
  );

  const allSlips = marina.docks.flatMap((d) => d.slips.map((s) => ({ id: s.id, name: s.name })));

  return (
    <div className="grid gap-3 text-sm">
      {canWrite ? (
        <div className="flex gap-2">
          <Input
            value={dockName}
            onChange={(e) => setDockName(e.target.value)}
            placeholder="New dock name"
            className="max-w-xs"
          />
          <Button
            size="sm"
            disabled={pending || !dockName.trim()}
            onClick={() =>
              start(async () => {
                const res = await saveDock({ marinaId: marina.id, name: dockName });
                if (res.ok) {
                  setDockName("");
                  refresh();
                } else toast.error(res.error ?? "Failed");
              })
            }
          >
            Add dock
          </Button>
          <Button size="sm" variant="outline" onClick={() => openBoatForm({})}>
            New boat (unassigned)
          </Button>
        </div>
      ) : null}

      {marina.docks.length === 0 ? (
        <p className="text-muted-foreground">No docks yet.</p>
      ) : (
        marina.docks.map((d) => (
          <div key={d.id} className="rounded-md border p-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">Dock · {d.name}</span>
              <span className="flex gap-1">
                {canWrite ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSlipDock(d.id);
                      setSlipName("");
                    }}
                  >
                    + Slip
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => deleteDock(d.id, marina.id))}>
                    Delete
                  </Button>
                ) : null}
              </span>
            </div>
            <div className="ml-4 grid gap-2">
              {d.slips.map((s) => (
                <div key={s.id} className="rounded-md border p-2">
                  <div className="flex items-center justify-between">
                    <span>
                      Slip · {s.name}
                      {s.slipNumber ? <span className="text-muted-foreground"> #{s.slipNumber}</span> : null}
                      {!s.isActive ? <Badge variant="outline" className="ml-2">inactive</Badge> : null}
                      {s.occupancyStatus ? (
                        <span className="text-muted-foreground text-xs"> · {s.occupancyStatus}</span>
                      ) : null}
                    </span>
                    <span className="flex gap-1">
                      {canWrite ? (
                        <Button variant="ghost" size="sm" onClick={() => openBoatForm({ slipId: s.id, dockId: d.id })}>
                          + Boat
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => deleteSlip(s.id, marina.id))}>
                          Delete
                        </Button>
                      ) : null}
                    </span>
                  </div>
                  {s.boats.length ? (
                    <ul className="ml-4 grid gap-1">
                      {s.boats.map((b) => (
                        <BoatLine key={b.id} b={b} slips={allSlips} />
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {marina.unassignedBoats.length > 0 ? (
        <div className="rounded-md border border-dashed p-2">
          <p className="mb-1 font-medium">Unassigned boats</p>
          <ul className="ml-4 grid gap-1">
            {marina.unassignedBoats.map((b) => (
              <BoatLine key={b.id} b={b} slips={allSlips} />
            ))}
          </ul>
        </div>
      ) : null}

      {/* add slip dialog */}
      <Dialog open={slipDock !== null} onOpenChange={(o) => !o && setSlipDock(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add slip</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              start(async () => {
                const res = await saveSlip({
                  dock_id: slipDock,
                  marina_id: marina.id,
                  name: slipName,
                  slip_number: fd.get("slip_number"),
                  slip_type: fd.get("slip_type"),
                  min_loa: fd.get("min_loa") || null,
                  max_loa: fd.get("max_loa") || null,
                });
                if (res.ok) {
                  setSlipDock(null);
                  refresh();
                } else setErr(res.error ?? "Could not save");
              });
            }}
            className="grid gap-3"
          >
            <div className="grid gap-2">
              <Label htmlFor="slip-name">Name</Label>
              <Input id="slip-name" value={slipName} onChange={(e) => setSlipName(e.target.value)} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="slip_number">Slip #</Label>
                <Input id="slip_number" name="slip_number" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slip_type">Type</Label>
                <Input id="slip_type" name="slip_type" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="min_loa">Min LOA</Label>
                <Input id="min_loa" name="min_loa" type="number" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="max_loa">Max LOA</Label>
                <Input id="max_loa" name="max_loa" type="number" />
              </div>
            </div>
            {err ? <p className="text-destructive text-sm">{err}</p> : null}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
              <Button type="submit" disabled={pending || !slipName.trim()}>
                Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* add boat dialog */}
      <Dialog open={boatOpen} onOpenChange={setBoatOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New boat</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitBoat} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="boat_name">Boat name *</Label>
              <Input id="boat_name" name="boat_name" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="boat_type">Type</Label>
                <Input id="boat_type" name="boat_type" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="boat_model">Model</Label>
                <Input id="boat_model" name="boat_model" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="storage_status">Storage</Label>
                <Input id="storage_status" name="storage_status" defaultValue="wet" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Owner (claims + provisions any devices)</Label>
              <Select value={boatUser} onValueChange={(v) => setBoatUser(v ?? "none")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Don&apos;t assign</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Monitoring devices</Label>
              <div className="max-h-32 overflow-y-auto rounded-md border p-2">
                {inventoryDevices.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 py-0.5 text-sm">
                    <Checkbox
                      checked={boatDevices.includes(d.id)}
                      onCheckedChange={() =>
                        setBoatDevices((p) =>
                          p.includes(d.id) ? p.filter((x) => x !== d.id) : [...p, d.id],
                        )
                      }
                    />
                    {d.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="notification_email">Notification email</Label>
                <Input id="notification_email" name="notification_email" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notification_number">Notification phone</Label>
                <Input id="notification_number" name="notification_number" />
              </div>
            </div>
            {err ? <p className="text-destructive text-sm">{err}</p> : null}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
              <Button type="submit" disabled={pending}>
                Create boat
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
