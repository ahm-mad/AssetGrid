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
import type { MarinaTree as Tree, BoatNode, DockNode, SlipNode } from "@/lib/marina/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { StatusLabel } from "@/components/charts/status-dot";
import { MetricCell } from "@/components/charts/metric-cell";
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

/** Removes a boat from wherever it lives in the tree (a slip, or unassigned) and returns it. */
function removeBoatEverywhere(docks: DockNode[], unassignedBoats: BoatNode[], boatId: number) {
  let found: BoatNode | null = null;
  const nextDocks = docks.map((d) => ({
    ...d,
    slips: d.slips.map((s) => {
      const boat = s.boats.find((b) => b.id === boatId);
      if (!boat) return s;
      found = boat;
      return { ...s, boats: s.boats.filter((b) => b.id !== boatId) };
    }),
  }));
  let nextUnassigned = unassignedBoats;
  if (!found) {
    const boat = unassignedBoats.find((b) => b.id === boatId);
    if (boat) {
      found = boat;
      nextUnassigned = unassignedBoats.filter((b) => b.id !== boatId);
    }
  }
  return { docks: nextDocks, unassignedBoats: nextUnassigned, boat: found };
}

export function MarinaTree({
  marina,
  canWrite,
  canDelete,
  inventoryDevices,
  users,
  mock = false,
}: {
  marina: Tree;
  canWrite: boolean;
  canDelete: boolean;
  inventoryDevices: { id: number; label: string }[];
  users: { id: string; name: string }[];
  /** UI_MOCK_MODE — fake every write locally instead of hitting the (dead) backend. */
  mock?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [docks, setDocks] = React.useState<DockNode[]>(marina.docks);
  const [unassignedBoats, setUnassignedBoats] = React.useState<BoatNode[]>(marina.unassignedBoats);
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
  /** Mock mode: mutate local tree state instead of calling the (dead-backend) Server Action. */
  const act = (mockFn: () => void, realFn: () => Promise<{ ok: boolean; error?: string }>) =>
    mock ? mockFn() : run(realFn);

  function mockAddDock(name: string) {
    setDocks((prev) => [...prev, { id: Date.now(), name, slips: [] }]);
    toast.success("Dock added");
  }

  function mockDeleteDock(id: number) {
    setDocks((prev) => prev.filter((d) => d.id !== id));
    toast.success("Dock deleted");
  }

  function mockAddSlip(dockId: number, fields: Pick<SlipNode, "name" | "slipNumber" | "minLoa" | "maxLoa">) {
    const slip: SlipNode = {
      id: Date.now(),
      name: fields.name,
      slipNumber: fields.slipNumber,
      slipStatus: "vacant",
      occupancyStatus: "vacant",
      isActive: true,
      minLoa: fields.minLoa,
      maxLoa: fields.maxLoa,
      boats: [],
    };
    setDocks((prev) => prev.map((d) => (d.id === dockId ? { ...d, slips: [...d.slips, slip] } : d)));
    toast.success("Slip added");
  }

  function mockDeleteSlip(id: number) {
    setDocks((prev) => prev.map((d) => ({ ...d, slips: d.slips.filter((s) => s.id !== id) })));
    toast.success("Slip deleted");
  }

  function mockAddBoat(fields: {
    slipId: number | null;
    dockId: number | null;
    boatName: string;
    boatType: string | null;
    storageStatus: string | null;
    deviceCount: number;
  }) {
    const boat: BoatNode = {
      id: Date.now(),
      xnid: null,
      boatName: fields.boatName,
      boatType: fields.boatType,
      slipId: fields.slipId,
      dockId: fields.dockId,
      userId: null,
      isAssigned: fields.slipId != null,
      deviceCount: fields.deviceCount,
      storageStatus: fields.storageStatus,
    };
    if (fields.slipId == null) {
      setUnassignedBoats((prev) => [...prev, boat]);
    } else {
      setDocks((prev) =>
        prev.map((d) => ({
          ...d,
          slips: d.slips.map((s) => (s.id === fields.slipId ? { ...s, boats: [...s.boats, boat] } : s)),
        })),
      );
    }
    toast.success("Boat created");
  }

  function mockDeleteBoat(id: number) {
    const next = removeBoatEverywhere(docks, unassignedBoats, id);
    setDocks(next.docks);
    setUnassignedBoats(next.unassignedBoats);
    toast.success("Boat removed");
  }

  function mockAssignBoatToSlip(boatId: number, slipId: number | null) {
    const next = removeBoatEverywhere(docks, unassignedBoats, boatId);
    if (!next.boat) return;
    if (slipId == null) {
      setDocks(next.docks);
      setUnassignedBoats([...next.unassignedBoats, { ...next.boat, slipId: null, dockId: null, isAssigned: false }]);
    } else {
      const finalDocks = next.docks.map((d) => ({
        ...d,
        slips: d.slips.map((s) =>
          s.id === slipId
            ? { ...s, boats: [...s.boats, { ...next.boat!, slipId, dockId: d.id, isAssigned: true }] }
            : s,
        ),
      }));
      setDocks(finalDocks);
      setUnassignedBoats(next.unassignedBoats);
    }
    toast.success("Boat reassigned");
  }

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
    const boatName = String(fd.get("boat_name") ?? "").trim();

    if (mock) {
      if (!boatName) {
        setErr("Boat name required");
        return;
      }
      mockAddBoat({
        slipId: boatSlip,
        dockId: boatDock,
        boatName,
        boatType: (fd.get("boat_type") as string) || null,
        storageStatus: (fd.get("storage_status") as string) || "wet",
        deviceCount: boatDevices.length,
      });
      setBoatOpen(false);
      return;
    }

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
      <span className="flex items-center gap-2">
        ⛵ {b.boatName}
        {b.boatType ? <span className="text-muted-foreground text-xs"> · {b.boatType}</span> : null}
        {b.deviceCount ? (
          <Badge variant="secondary" className="font-mono">
            {b.deviceCount} dev
          </Badge>
        ) : null}
        {b.storageStatus ? <span className="text-muted-foreground eyebrow"> {b.storageStatus}</span> : null}
      </span>
      <span className="flex items-center gap-1">
        {canWrite ? (
          <Select
            value={b.slipId ? String(b.slipId) : "none"}
            onValueChange={(v) => {
              const slipId = v === "none" ? null : Number(v);
              act(
                () => mockAssignBoatToSlip(b.id, slipId),
                () => assignBoatToSlip(b.id, slipId, marina.id),
              );
            }}
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
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => act(() => mockDeleteBoat(b.id), () => deleteBoat(b.id, marina.id))}
          >
            Remove
          </Button>
        ) : null}
      </span>
    </li>
  );

  const allSlips = docks.flatMap((d) => d.slips.map((s) => ({ id: s.id, name: s.name })));
  const slipCount = docks.reduce((s, d) => s + d.slips.length, 0);
  const boatCount =
    docks.reduce((s, d) => s + d.slips.reduce((s2, sl) => s2 + sl.boats.length, 0), 0) + unassignedBoats.length;

  return (
    <div className="grid gap-4 text-sm">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCell label="Docks" value={docks.length} />
        <MetricCell label="Slips" value={slipCount} />
        <MetricCell label="Boats" value={boatCount} />
        <MetricCell label="Unassigned" value={unassignedBoats.length} />
      </div>

      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <Input
            value={dockName}
            onChange={(e) => setDockName(e.target.value)}
            placeholder="New dock name"
            className="max-w-xs"
          />
          <Button
            size="sm"
            disabled={pending || !dockName.trim()}
            onClick={() => {
              if (mock) {
                mockAddDock(dockName.trim());
                setDockName("");
                return;
              }
              start(async () => {
                const res = await saveDock({ marinaId: marina.id, name: dockName });
                if (res.ok) {
                  setDockName("");
                  refresh();
                } else toast.error(res.error ?? "Failed");
              });
            }}
          >
            Add dock
          </Button>
          <Button size="sm" variant="outline" onClick={() => openBoatForm({})}>
            New boat (unassigned)
          </Button>
        </div>
      ) : null}

      {docks.length === 0 ? (
        <p className="text-muted-foreground">No docks yet.</p>
      ) : (
        <div className="grid gap-3">
          {docks.map((d) => (
            <div key={d.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="eyebrow">Dock</p>
                  <p className="mt-0.5 text-sm font-semibold">{d.name}</p>
                </div>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => act(() => mockDeleteDock(d.id), () => deleteDock(d.id, marina.id))}
                    >
                      Delete
                    </Button>
                  ) : null}
                </span>
              </div>
              <div className="mt-2 ml-4 grid gap-2">
                {d.slips.map((s) => (
                  <div key={s.id} className="bg-muted/40 rounded-md border p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="eyebrow">Slip</p>
                          <p className="mt-0.5 text-sm font-medium">
                            {s.name}
                            {s.slipNumber ? (
                              <span className="text-muted-foreground font-mono text-xs"> #{s.slipNumber}</span>
                            ) : null}
                          </p>
                        </div>
                        {!s.isActive ? <StatusLabel status="warning">Inactive</StatusLabel> : null}
                        {s.occupancyStatus ? (
                          <StatusLabel status={s.occupancyStatus === "occupied" ? "online" : "offline"}>
                            {s.occupancyStatus}
                          </StatusLabel>
                        ) : null}
                      </div>
                      <span className="flex gap-1">
                        {canWrite ? (
                          <Button variant="ghost" size="sm" onClick={() => openBoatForm({ slipId: s.id, dockId: d.id })}>
                            + Boat
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() => act(() => mockDeleteSlip(s.id), () => deleteSlip(s.id, marina.id))}
                          >
                            Delete
                          </Button>
                        ) : null}
                      </span>
                    </div>
                    {s.boats.length ? (
                      <ul className="mt-1.5 ml-4 grid gap-1">
                        {s.boats.map((b) => (
                          <BoatLine key={b.id} b={b} slips={allSlips} />
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {unassignedBoats.length > 0 ? (
        <div className="rounded-md border border-dashed p-3">
          <p className="eyebrow mb-2">Unassigned boats</p>
          <ul className="ml-4 grid gap-1">
            {unassignedBoats.map((b) => (
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
              const name = slipName.trim();
              if (mock) {
                if (!name || slipDock == null) {
                  setErr("Name required");
                  return;
                }
                mockAddSlip(slipDock, {
                  name,
                  slipNumber: (fd.get("slip_number") as string) || null,
                  minLoa: fd.get("min_loa") ? Number(fd.get("min_loa")) : null,
                  maxLoa: fd.get("max_loa") ? Number(fd.get("max_loa")) : null,
                });
                setSlipDock(null);
                return;
              }
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
