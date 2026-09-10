"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { activateDevices, type ActivateDeviceResult } from "@/lib/devices/activate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ClaimDeviceDialog({
  selfId,
  users,
}: {
  selfId: string;
  users: { id: string; name: string }[] | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [userId, setUserId] = React.useState(selfId);
  const [rows, setRows] = React.useState([{ name: "", location: "", code: "" }]);
  const [results, setResults] = React.useState<ActivateDeviceResult[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  function reset() {
    setRows([{ name: "", location: "", code: "" }]);
    setResults(null);
    setErr(null);
    setUserId(selfId);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setResults(null);
    const devices = rows
      .filter((r) => r.code.trim())
      .map((r) => ({
        device_name: r.name.trim(),
        device_location: r.location.trim(),
        activation_code: r.code.trim(),
      }));
    if (devices.length === 0) {
      setErr("Add at least one activation code.");
      return;
    }
    start(async () => {
      const res = await activateDevices({ user_id: userId, devices });
      if (res.ok) {
        setResults(res.results ?? []);
        if ((res.results ?? []).some((r) => r.success)) {
          toast.success("Devices processed");
          router.refresh();
        }
      } else {
        setErr(res.error ?? (res.fieldErrors ? "Check the fields." : "Could not claim"));
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger render={<Button size="sm">Claim device</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Claim a device</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          {users ? (
            <div className="grid gap-2">
              <Label>Account</Label>
              <Select value={userId} onValueChange={(v) => setUserId(v ?? selfId)}>
                <SelectTrigger>
                  <SelectValue />
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
          ) : null}

          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <Input
                placeholder="Device name"
                value={r.name}
                onChange={(e) =>
                  setRows((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
              />
              <Input
                placeholder="Location"
                value={r.location}
                onChange={(e) =>
                  setRows((p) => p.map((x, j) => (j === i ? { ...x, location: e.target.value } : x)))
                }
              />
              <Input
                placeholder="Activation code"
                className="font-mono text-xs"
                value={r.code}
                onChange={(e) =>
                  setRows((p) => p.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))
                }
              />
            </div>
          ))}
          <button
            type="button"
            className="text-muted-foreground justify-self-start text-sm underline"
            onClick={() => setRows((p) => [...p, { name: "", location: "", code: "" }])}
          >
            + another device
          </button>

          {err ? <p className="text-destructive text-sm">{err}</p> : null}

          {results ? (
            <ul className="grid gap-1 text-sm">
              {results.map((r, i) => (
                <li key={i} className={r.success ? "text-foreground" : "text-destructive"}>
                  <span className="font-mono text-xs">{r.activationCode}</span> — {r.message}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Working…" : "Claim"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
