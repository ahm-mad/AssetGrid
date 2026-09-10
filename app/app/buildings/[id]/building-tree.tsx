"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  saveHierarchyNode,
  deleteHierarchyNode,
  saveSite,
  deleteSite,
} from "@/lib/buildings/actions";
import type { BuildingTree as Tree } from "@/lib/buildings/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type NodeKind = "floors" | "units" | "areas";

export function BuildingTree({
  building,
  canWrite,
  canDelete,
  inventoryDevices,
  users,
}: {
  building: Tree;
  canWrite: boolean;
  canDelete: boolean;
  inventoryDevices: { id: number; label: string }[];
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [addKind, setAddKind] = React.useState<NodeKind | null>(null);
  const [addParent, setAddParent] = React.useState(0);
  const [addName, setAddName] = React.useState("");
  const [siteAreaId, setSiteAreaId] = React.useState(0);
  const [siteInvId, setSiteInvId] = React.useState("");
  const [siteUserId, setSiteUserId] = React.useState("none");
  const [err, setErr] = React.useState<string | null>(null);

  const refresh = () => router.refresh();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) refresh();
      else toast.error(res.error ?? "Failed");
    });

  function submitNode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!addKind) return;
    setErr(null);
    start(async () => {
      const res = await saveHierarchyNode({ kind: addKind, name: addName, parentId: addParent });
      if (res.ok) {
        setAddKind(null);
        setAddName("");
        refresh();
      } else setErr(res.error ?? "Could not save");
    });
  }

  function submitSite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    start(async () => {
      const res = await saveSite({
        building_id: building.id,
        area_id: siteAreaId,
        inventory_device_id: siteInvId,
        user_id: siteUserId === "none" ? null : siteUserId,
        room_name: fd.get("room_name"),
        point: fd.get("point") || "0",
        notification_email: fd.get("notification_email"),
        notification_number: fd.get("notification_number"),
      });
      if (res.ok) {
        setSiteAreaId(0);
        setSiteInvId("");
        setSiteUserId("none");
        refresh();
      } else setErr(res.error ?? "Could not save");
    });
  }

  const openAdd = (kind: NodeKind, parentId: number) => {
    setAddKind(kind);
    setAddParent(parentId);
    setAddName("");
    setErr(null);
  };

  return (
    <div className="grid gap-2 text-sm">
      {canWrite ? (
        <div>
          <Button size="sm" variant="outline" onClick={() => openAdd("floors", building.id)}>
            + Floor
          </Button>
        </div>
      ) : null}

      {building.floors.length === 0 ? (
        <p className="text-muted-foreground">No floors yet.</p>
      ) : (
        building.floors.map((f) => (
          <div key={f.id} className="rounded-md border p-2">
            <Row
              label={`Floor · ${f.name}`}
              onAdd={canWrite ? () => openAdd("units", f.id) : undefined}
              addLabel="+ Unit"
              onDelete={canDelete ? () => run(() => deleteHierarchyNode("floors", f.id)) : undefined}
              pending={pending}
            />
            <div className="ml-4 grid gap-2">
              {f.units.map((u) => (
                <div key={u.id} className="rounded-md border p-2">
                  <Row
                    label={`Unit · ${u.name}`}
                    onAdd={canWrite ? () => openAdd("areas", u.id) : undefined}
                    addLabel="+ Area"
                    onDelete={canDelete ? () => run(() => deleteHierarchyNode("units", u.id)) : undefined}
                    pending={pending}
                  />
                  <div className="ml-4 grid gap-2">
                    {u.areas.map((a) => (
                      <div key={a.id} className="rounded-md border p-2">
                        <Row
                          label={`Area · ${a.name}`}
                          onAdd={canWrite ? () => setSiteAreaId(a.id) : undefined}
                          addLabel="+ Site"
                          onDelete={canDelete ? () => run(() => deleteHierarchyNode("areas", a.id)) : undefined}
                          pending={pending}
                        />
                        <ul className="ml-4 grid gap-1">
                          {a.sites.map((s) => (
                            <li key={s.id} className="flex items-center justify-between">
                              <span>
                                📍 {s.roomName}
                                {s.inventoryDeviceName ? (
                                  <span className="text-muted-foreground"> · {s.inventoryDeviceName}</span>
                                ) : null}
                                {s.devEui ? (
                                  <span className="text-muted-foreground font-mono text-xs"> {s.devEui}</span>
                                ) : null}
                              </span>
                              {canDelete ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={pending}
                                  onClick={() => run(() => deleteSite(s.id))}
                                >
                                  Remove
                                </Button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* add floor/unit/area dialog */}
      <Dialog open={addKind !== null} onOpenChange={(o) => !o && setAddKind(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add {addKind?.replace(/s$/, "")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitNode} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="node-name">Name</Label>
              <Input id="node-name" value={addName} onChange={(e) => setAddName(e.target.value)} autoFocus />
            </div>
            {err ? <p className="text-destructive text-sm">{err}</p> : null}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
              <Button type="submit" disabled={pending || !addName.trim()}>
                Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* add site dialog */}
      <Dialog open={siteAreaId !== 0} onOpenChange={(o) => !o && setSiteAreaId(0)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mount a device (new site)</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitSite} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="room_name">Room name *</Label>
              <Input id="room_name" name="room_name" autoFocus />
            </div>
            <div className="grid gap-2">
              <Label>Inventory device *</Label>
              <Select value={siteInvId} onValueChange={(v) => setSiteInvId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a device" />
                </SelectTrigger>
                <SelectContent>
                  {inventoryDevices.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Assign to user (claims + provisions the device)</Label>
              <Select value={siteUserId} onValueChange={(v) => setSiteUserId(v ?? "none")}>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="point">Alarm zone (point)</Label>
                <Input id="point" name="point" defaultValue="0" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notification_email">Notification email</Label>
              <Input id="notification_email" name="notification_email" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notification_number">Notification phone</Label>
              <Input id="notification_number" name="notification_number" />
            </div>
            {err ? <p className="text-destructive text-sm">{err}</p> : null}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
              <Button type="submit" disabled={pending || !siteInvId}>
                Create site
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <p className="text-muted-foreground pt-2 text-xs">
        Deleting a node cascades to everything under it. A device&apos;s live data is on its{" "}
        <Link href="/app/devices" className="underline">
          device page
        </Link>
        .
      </p>
    </div>
  );
}

function Row({
  label,
  onAdd,
  addLabel,
  onDelete,
  pending,
}: {
  label: string;
  onAdd?: () => void;
  addLabel: string;
  onDelete?: () => void;
  pending: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-medium">{label}</span>
      <span className="flex gap-1">
        {onAdd ? (
          <Button variant="ghost" size="sm" onClick={onAdd}>
            {addLabel}
          </Button>
        ) : null}
        {onDelete ? (
          <Button variant="ghost" size="sm" disabled={pending} onClick={onDelete}>
            Delete
          </Button>
        ) : null}
      </span>
    </div>
  );
}
