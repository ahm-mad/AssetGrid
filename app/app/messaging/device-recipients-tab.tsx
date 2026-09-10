"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { saveDeviceRecipients } from "@/lib/messaging/actions";
import type { DeviceRecipientsRow } from "@/lib/messaging/data";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function DeviceRecipientsTab({
  rows,
  userDevices,
}: {
  rows: DeviceRecipientsRow[];
  userDevices: { id: number; label: string }[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DeviceRecipientsRow | null>(null);
  const [deviceId, setDeviceId] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);

  function openNew() {
    setEditing(null);
    setDeviceId("");
    setErr(null);
    setOpen(true);
  }
  function openEdit(r: DeviceRecipientsRow) {
    setEditing(r);
    setDeviceId(String(r.userDeviceId ?? ""));
    setErr(null);
    setOpen(true);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    const split = (s: FormDataEntryValue | null) =>
      String(s ?? "")
        .split(/[,\n]/)
        .map((x) => x.trim())
        .filter(Boolean);
    start(async () => {
      const res = await saveDeviceRecipients({
        user_device_id: deviceId,
        emails: split(fd.get("emails")),
        phone_numbers: split(fd.get("phones")),
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
        Extra email / phone recipients for a specific device&apos;s alerts (in addition to the owner).
      </p>
      <div>
        <Button size="sm" onClick={openNew}>
          Add device recipients
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>Emails</TableHead>
              <TableHead>Phones</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground text-center">
                  None configured.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.deviceName ?? `Device #${r.userDeviceId}`}
                  </TableCell>
                  <TableCell className="text-xs">{r.emails.join(", ") || "—"}</TableCell>
                  <TableCell className="text-xs">{r.phoneNumbers.join(", ") || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                      Edit
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
            <DialogTitle>{editing ? "Edit recipients" : "Add recipients"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-3">
            <div className="grid gap-2">
              <Label>Device</Label>
              <Select value={deviceId} onValueChange={(v) => setDeviceId(v ?? "")} disabled={!!editing}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a device" />
                </SelectTrigger>
                <SelectContent>
                  {userDevices.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emails">Emails (comma or newline separated)</Label>
              <Input id="emails" name="emails" defaultValue={editing?.emails.join(", ") ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phones">Phone numbers</Label>
              <Input id="phones" name="phones" defaultValue={editing?.phoneNumbers.join(", ") ?? ""} />
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
