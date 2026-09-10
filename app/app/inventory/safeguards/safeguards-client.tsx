"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  saveSafeguardConfiguration,
  deleteSafeguardConfiguration,
  toggleSafeguardActive,
} from "@/lib/inventory/actions";
import type { SafeguardConfigRow } from "@/lib/inventory/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  inventoryDevices: { id: number; label: string }[];
  userDevices: { id: number; label: string }[];
}

export function SafeguardsClient({
  rows,
  options,
  canCreate,
  canEdit,
  canDelete,
}: {
  rows: SafeguardConfigRow[];
  options: Options;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SafeguardConfigRow | null>(null);
  const [target, setTarget] = React.useState<"none" | "inventory" | "user">("none");
  const [targetId, setTargetId] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [paused, setPaused] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  function openNew() {
    setEditing(null);
    setTarget("none");
    setTargetId("");
    setActive(true);
    setPaused(false);
    setErr(null);
    setOpen(true);
  }

  function openEdit(r: SafeguardConfigRow) {
    setEditing(r);
    setTarget(r.inventoryDeviceId ? "inventory" : r.userDeviceId ? "user" : "none");
    setTargetId(String(r.inventoryDeviceId ?? r.userDeviceId ?? ""));
    setActive(r.isActive);
    setPaused(r.notificationsPaused);
    setErr(null);
    setOpen(true);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    start(async () => {
      const res = await saveSafeguardConfiguration({
        id: editing?.id,
        inventory_device_id: target === "inventory" && targetId ? targetId : null,
        user_device_id: target === "user" && targetId ? targetId : null,
        abnormal_alert_limit: fd.get("abnormal_alert_limit"),
        alert_interval_hours: fd.get("alert_interval_hours"),
        support_email_sent: String(fd.get("support_email_sent") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        support_number_sent: String(fd.get("support_number_sent") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        is_active: active,
        notifications_paused: paused,
      });
      if (res.ok) {
        toast.success("Saved");
        setOpen(false);
        router.refresh();
      } else setErr(res.error ?? "Could not save");
    });
  }

  const deviceLabel = (r: SafeguardConfigRow) => {
    if (r.inventoryDeviceId) {
      return options.inventoryDevices.find((d) => d.id === r.inventoryDeviceId)?.label ?? `inv #${r.inventoryDeviceId}`;
    }
    if (r.userDeviceId) {
      return options.userDevices.find((d) => d.id === r.userDeviceId)?.label ?? `dev #${r.userDeviceId}`;
    }
    return "global";
  };

  return (
    <div className="grid gap-3">
      {canCreate ? (
        <div>
          <Button size="sm" onClick={openNew}>
            New configuration
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Target</TableHead>
              <TableHead>Limit</TableHead>
              <TableHead>Interval (h)</TableHead>
              <TableHead>Active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground text-center">
                  No safeguard configurations.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{deviceLabel(r)}</TableCell>
                  <TableCell>{r.abnormalAlertLimit}</TableCell>
                  <TableCell>{r.alertIntervalHours}</TableCell>
                  <TableCell>
                    <Badge variant={r.isActive ? "secondary" : "outline"}>
                      {r.isActive ? "active" : "inactive"}
                    </Badge>
                    {r.notificationsPaused ? (
                      <Badge variant="outline" className="ml-1">
                        paused
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {canEdit ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const res = await toggleSafeguardActive(r.id, !r.isActive);
                              if (res.ok) router.refresh();
                              else toast.error(res.error ?? "Failed");
                            })
                          }
                        >
                          {r.isActive ? "Disable" : "Enable"}
                        </Button>
                      </>
                    ) : null}
                    {canDelete ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const res = await deleteSafeguardConfiguration(r.id);
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit configuration" : "New configuration"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-3">
            <div className="grid gap-2">
              <Label>Applies to</Label>
              <Select value={target} onValueChange={(v) => setTarget((v as typeof target) ?? "none")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Global (all devices)</SelectItem>
                  <SelectItem value="inventory">One inventory device</SelectItem>
                  <SelectItem value="user">One claimed device</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {target !== "none" ? (
              <div className="grid gap-2">
                <Label>Device</Label>
                <Select value={targetId} onValueChange={(v) => setTargetId(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a device" />
                  </SelectTrigger>
                  <SelectContent>
                    {(target === "inventory" ? options.inventoryDevices : options.userDevices).map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="abnormal_alert_limit">Abnormal alert limit</Label>
                <Input
                  id="abnormal_alert_limit"
                  name="abnormal_alert_limit"
                  type="number"
                  min={0}
                  defaultValue={editing?.abnormalAlertLimit ?? 3}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="alert_interval_hours">Interval (hours)</Label>
                <Input
                  id="alert_interval_hours"
                  name="alert_interval_hours"
                  type="number"
                  min={0}
                  step="0.5"
                  defaultValue={editing?.alertIntervalHours ?? 24}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="support_email_sent">Support emails (comma-separated)</Label>
              <Input
                id="support_email_sent"
                name="support_email_sent"
                defaultValue={editing?.supportEmailSent.join(", ") ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="support_number_sent">Support numbers (comma-separated)</Label>
              <Input
                id="support_number_sent"
                name="support_number_sent"
                defaultValue={editing?.supportNumberSent.join(", ") ?? ""}
              />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={active} onCheckedChange={setActive} /> Active
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={paused} onCheckedChange={setPaused} /> Notifications paused
              </label>
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
