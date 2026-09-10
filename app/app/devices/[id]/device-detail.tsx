"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { UserDeviceBundle } from "@/lib/devices/data";
import { updateUserDeviceFields, toggleUserDevice, saveDeviceParameters } from "@/lib/devices/actions";
import {
  changeChargingStatus,
  setChargingTimer,
  saveDeviceSchedule,
  deleteDeviceSchedule,
  saveSunsetSchedule,
  deleteSunsetSchedule,
} from "@/lib/charging/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { LiveReadingCard } from "@/components/realtime/live-reading-card";

const DAY_ABBR: [string, string][] = [
  ["Monday", "Mon"],
  ["Tuesday", "Tue"],
  ["Wednesday", "Wed"],
  ["Thursday", "Thu"],
  ["Friday", "Fri"],
  ["Saturday", "Sat"],
  ["Sunday", "Sun"],
];

function daysList(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return [];
}

export function DeviceDetail({
  bundle,
  canControl,
}: {
  bundle: UserDeviceBundle;
  canControl: boolean;
  canDelete: boolean;
}) {
  const { device, parameters, schedules, sunsetRises, chargingTimers, chargingState, chargingDetail } =
    bundle;
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [toggle, setToggle] = React.useState(device.toggleStatus);

  const quickTimer = chargingTimers.find((t) => t.kind === "quick") ?? null;
  const isOn = chargingState?.isOn === true;

  function fieldSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateUserDeviceFields({
        id: device.id,
        device_name: fd.get("device_name"),
        device_location: fd.get("device_location"),
        notification_email: fd.get("notification_email"),
        notification_phone_number: fd.get("notification_phone_number"),
      });
      if (res.ok) {
        toast.success("Saved");
        router.refresh();
      } else toast.error(res.error ?? "Failed");
    });
  }

  function onToggle(next: boolean) {
    setToggle(next);
    start(async () => {
      const res = await toggleUserDevice(device.id);
      if (res.ok) setToggle(res.toggleStatus ?? next);
      else {
        setToggle(!next);
        toast.error(res.error ?? "Failed");
      }
    });
  }

  function doCharging() {
    start(async () => {
      const res = await changeChargingStatus({ user_device_id: device.id, dev_eui: device.devEui ?? undefined });
      if (res.ok) {
        toast.success(res.message ?? "Done");
        router.refresh();
      } else toast.error(res.error ?? "Failed");
    });
  }

  function quickTimerSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const active = fd.get("timer_active") === "on";
    start(async () => {
      const res = await setChargingTimer({
        user_device_id: device.id,
        charging_time: fd.get("charging_time") || null,
        active,
      });
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        router.refresh();
      } else toast.error(res.error ?? "Failed");
    });
  }

  function paramsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const num = (k: string) => {
      const v = fd.get(k);
      return v === "" || v == null ? null : Number(v);
    };
    start(async () => {
      const res = await saveDeviceParameters({
        user_device_id: device.id,
        battery_voltage: num("battery_voltage"),
        battery_capacity: num("battery_capacity"),
        desired_charging: num("desired_charging"),
        charging_limits: num("charging_limits"),
        charger_voltage: num("charger_voltage"),
        charger_amperes: num("charger_amperes"),
        over_current_protection: fd.get("over_current_protection") === "on",
        over_voltage_protection: fd.get("over_voltage_protection") === "on",
        sms_alert: fd.get("sms_alert") === "on",
        email_alert: fd.get("email_alert") === "on",
      });
      if (res.ok) {
        toast.success("Saved");
        router.refresh();
      } else toast.error(res.error ?? res.fieldErrors ? "Check the values" : "Failed");
    });
  }

  return (
    <div className="grid gap-4">
      {/* --------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Device</CardTitle>
          <CardDescription>{device.xnid ?? "no xnid"}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form onSubmit={fieldSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="device_name">Name</Label>
              <Input id="device_name" name="device_name" defaultValue={device.deviceName ?? ""} disabled={!canControl} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="device_location">Location</Label>
              <Input
                id="device_location"
                name="device_location"
                defaultValue={device.deviceLocation ?? ""}
                disabled={!canControl}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notification_email">Notification email</Label>
              <Input
                id="notification_email"
                name="notification_email"
                defaultValue={device.notificationEmail ?? ""}
                disabled={!canControl}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notification_phone_number">Notification phone</Label>
              <Input
                id="notification_phone_number"
                name="notification_phone_number"
                defaultValue={device.notificationPhoneNumber ?? ""}
                disabled={!canControl}
              />
            </div>
            {canControl ? (
              <div className="sm:col-span-2">
                <Button type="submit" disabled={pending}>
                  Save
                </Button>
              </div>
            ) : null}
          </form>

          <div className="flex items-center gap-2 border-t pt-4">
            <Switch id="toggle" checked={toggle} onCheckedChange={onToggle} disabled={pending} />
            <Label htmlFor="toggle">Device toggle (toggle_status)</Label>
          </div>
        </CardContent>
      </Card>

      {/* --------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Charging</CardTitle>
          <CardDescription>
            {chargingState
              ? `State: ${isOn ? "on" : "off"}${chargingState.isCharging ? " · charging" : ""}${
                  chargingState.lastCommandAt
                    ? ` · last command ${new Date(chargingState.lastCommandAt).toLocaleString()}`
                    : ""
                }`
              : "No charging-state row for this device yet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {canControl && chargingState ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={doCharging} disabled={pending} variant={isOn ? "destructive" : "default"}>
                {isOn ? "Stop charging" : "Start charging"}
              </Button>
              <span className="text-muted-foreground text-xs">
                Physical downlink is stubbed until LNS credentials are configured (A8).
              </span>
            </div>
          ) : null}

          {canControl ? (
            <form onSubmit={quickTimerSubmit} className="flex flex-wrap items-end gap-3 border-t pt-4">
              <div className="grid gap-2">
                <Label htmlFor="charging_time">Quick timer (seconds)</Label>
                <Input
                  id="charging_time"
                  name="charging_time"
                  type="number"
                  min={0}
                  defaultValue={quickTimer?.seconds ?? ""}
                  className="w-40"
                />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <Checkbox name="timer_active" defaultChecked={quickTimer?.isActive ?? false} /> Active
              </label>
              <Button type="submit" variant="outline" disabled={pending} className="mb-0.5">
                Set timer
              </Button>
            </form>
          ) : null}

          <div className="border-t pt-4">
            <LiveReadingCard userDeviceId={device.id} initialAt={device.lastReadingAt} />
          </div>

          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium">Latest reading</p>
            {chargingDetail.hasReading ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                <Metric label="Charging progress" value={`${chargingDetail.chargingProgress ?? "—"}%`} />
                <Metric label="Active energy" value={chargingDetail.activeEnergy ?? "—"} />
                <Metric label="Charging time" value={chargingDetail.chargingTime ?? "—"} />
                <Metric label="Power factor" value={chargingDetail.powerFactorStatus ?? "—"} />
                <Metric label="Voltage / current" value={chargingDetail.voltageCurrentStatus ?? "—"} />
                <Metric label="Over-current" value={chargingDetail.overcurrentStatus ?? "—"} />
                <Metric label="Over-voltage" value={chargingDetail.overvoltageStatus ?? "—"} />
              </dl>
            ) : (
              <p className="text-muted-foreground text-sm">
                No telemetry cached for this device yet — the reading cache fills once ingestion
                (slice 5) / the ETL (Phase N+1) runs.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* --------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Battery / charger parameters</CardTitle>
          <CardDescription>
            {parameters
              ? parameters.isDefault
                ? "Showing the default profile — saving creates a device-specific one."
                : "Device-specific profile."
              : "No profile — saving creates one."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={paramsSubmit} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <NumField label="Battery voltage" name="battery_voltage" value={parameters?.batteryVoltage} disabled={!canControl} />
              <NumField label="Battery capacity" name="battery_capacity" value={parameters?.batteryCapacity} disabled={!canControl} />
              <NumField label="Desired charging" name="desired_charging" value={parameters?.desiredCharging} disabled={!canControl} />
              <NumField label="Charging limits" name="charging_limits" value={parameters?.chargingLimits} disabled={!canControl} />
              <NumField label="Charger voltage" name="charger_voltage" value={parameters?.chargerVoltage} disabled={!canControl} />
              <NumField label="Charger amperes" name="charger_amperes" value={parameters?.chargerAmperes} disabled={!canControl} />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <ChkField label="Over-current protection" name="over_current_protection" checked={parameters?.overCurrentProtection ?? true} disabled={!canControl} />
              <ChkField label="Over-voltage protection" name="over_voltage_protection" checked={parameters?.overVoltageProtection ?? true} disabled={!canControl} />
              <ChkField label="SMS alert" name="sms_alert" checked={parameters?.smsAlert ?? true} disabled={!canControl} />
              <ChkField label="Email alert" name="email_alert" checked={parameters?.emailAlert ?? true} disabled={!canControl} />
            </div>
            {canControl ? (
              <div>
                <Button type="submit" disabled={pending}>
                  Save parameters
                </Button>
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {/* --------------------------------------------------------------- */}
      <ScheduleCard
        title="Clock schedules"
        description="Turn the device on/off between two times on selected days."
        userDeviceId={device.id}
        canControl={canControl}
        rows={schedules.map((s) => ({
          id: s.id,
          summary: `${s.startTime}–${s.endTime}`,
          days: daysList(s.selectedDays),
          turnOn: s.turnOn,
        }))}
        kind="clock"
        pending={pending}
        onSaved={() => router.refresh()}
      />

      <ScheduleCard
        title="Sunrise / sunset schedules"
        description="Astronomical schedule — offsets in minutes from sunrise / sunset."
        userDeviceId={device.id}
        canControl={canControl}
        rows={sunsetRises.map((s) => ({
          id: s.id,
          summary: `sunrise ${s.sunrise}m · sunset ${s.sunset}m`,
          days: daysList(s.selectedDays),
          turnOn: s.turnOn,
        }))}
        kind="sunset"
        pending={pending}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function NumField({
  label,
  name,
  value,
  disabled,
}: {
  label: string;
  name: string;
  value: number | null | undefined;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" defaultValue={value ?? ""} disabled={disabled} />
    </div>
  );
}

function ChkField({
  label,
  name,
  checked,
  disabled,
}: {
  label: string;
  name: string;
  checked: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox name={name} defaultChecked={checked} disabled={disabled} />
      {label}
    </label>
  );
}

interface ScheduleRow {
  id: number;
  summary: string;
  days: string[];
  turnOn: boolean;
}

function ScheduleCard({
  title,
  description,
  userDeviceId,
  canControl,
  rows,
  kind,
  pending,
  onSaved,
}: {
  title: string;
  description: string;
  userDeviceId: number;
  canControl: boolean;
  rows: ScheduleRow[];
  kind: "clock" | "sunset";
  pending: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [days, setDays] = React.useState<string[]>([]);
  const [busy, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);

  function toggleDay(full: string) {
    setDays((p) => (p.includes(full) ? p.filter((d) => d !== full) : [...p, full]));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    start(async () => {
      const res =
        kind === "clock"
          ? await saveDeviceSchedule({
              user_device_id: userDeviceId,
              start_time: fd.get("start_time"),
              end_time: fd.get("end_time"),
              selected_days: days,
              reminder: fd.get("reminder") === "on",
            })
          : await saveSunsetSchedule({
              user_device_id: userDeviceId,
              sunrise: fd.get("sunrise"),
              sunset: fd.get("sunset"),
              selected_days: days,
              reminder: fd.get("reminder") === "on",
            });
      if (res.ok) {
        toast.success("Saved");
        setOpen(false);
        setDays([]);
        onSaved();
      } else setErr(res.error ?? "Could not save");
    });
  }

  function remove(id: number) {
    start(async () => {
      const res =
        kind === "clock"
          ? await deleteDeviceSchedule(id, userDeviceId)
          : await deleteSunsetSchedule(id, userDeviceId);
      if (res.ok) onSaved();
      else toast.error(res.error ?? "Failed");
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {canControl ? (
          <Button
            size="sm"
            onClick={() => {
              setDays([]);
              setErr(null);
              setOpen(true);
            }}
          >
            Add
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">None set.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>On</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.summary}</TableCell>
                  <TableCell>{r.days.join(", ") || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.turnOn ? "secondary" : "outline"}>{r.turnOn ? "yes" : "no"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canControl ? (
                      <Button variant="ghost" size="sm" disabled={pending || busy} onClick={() => remove(r.id)}>
                        Delete
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add {kind === "clock" ? "clock" : "sunrise/sunset"} schedule</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-3">
            {kind === "clock" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="start_time">Start</Label>
                  <Input id="start_time" name="start_time" type="time" defaultValue="18:00" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end_time">End</Label>
                  <Input id="end_time" name="end_time" type="time" defaultValue="06:00" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="sunrise">Sunrise offset (min)</Label>
                  <Input id="sunrise" name="sunrise" type="number" defaultValue={0} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sunset">Sunset offset (min)</Label>
                  <Input id="sunset" name="sunset" type="number" defaultValue={0} />
                </div>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Days</Label>
              <div className="flex flex-wrap gap-3">
                {DAY_ABBR.map(([full, abbr]) => (
                  <label key={full} className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={days.includes(full)} onCheckedChange={() => toggleDay(full)} />
                    {abbr}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="reminder" /> Send reminder
            </label>
            {err ? <p className="text-destructive text-sm">{err}</p> : null}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
