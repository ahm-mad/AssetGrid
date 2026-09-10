"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setNotificationPrefs } from "@/lib/messaging/actions";
import type { NotificationPrefRow } from "@/lib/messaging/data";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const FIELDS: [keyof NotificationPrefRow, string][] = [
  ["emailEnabled", "Email"],
  ["phoneEnabled", "SMS / phone"],
  ["customerEmailEnabled", "Customer email"],
  ["customerPhoneEnabled", "Customer phone"],
  ["managerEmailEnabled", "Manager email"],
  ["managerPhoneEnabled", "Manager phone"],
  ["deviceEmailEnabled", "Device email"],
  ["devicePhoneEnabled", "Device phone"],
];

const KEY_MAP: Record<string, string> = {
  emailEnabled: "email_enabled",
  phoneEnabled: "phone_enabled",
  customerEmailEnabled: "customer_email_enabled",
  customerPhoneEnabled: "customer_phone_enabled",
  managerEmailEnabled: "manager_email_enabled",
  managerPhoneEnabled: "manager_phone_enabled",
  deviceEmailEnabled: "device_email_enabled",
  devicePhoneEnabled: "device_phone_enabled",
};

export function NotificationPrefsForm({ prefs }: { prefs: NotificationPrefRow | null }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [state, setState] = React.useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const [k] of FIELDS) init[k] = prefs ? (prefs[k] as boolean) : false;
    return init;
  });

  function save() {
    start(async () => {
      const payload: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(state)) payload[KEY_MAP[k]] = v;
      const res = await setNotificationPrefs(payload);
      if (res.ok) {
        toast.success("Saved");
        router.refresh();
      } else toast.error(res.error ?? "Failed");
    });
  }

  return (
    <div className="grid max-w-md gap-3">
      <p className="text-muted-foreground text-sm">
        Which channels the alert engine may use for you. (An empty set means no alerts.)
      </p>
      {FIELDS.map(([k, label]) => (
        <div key={k} className="flex items-center justify-between rounded-md border px-3 py-2">
          <Label htmlFor={k}>{label}</Label>
          <Switch
            id={k}
            checked={state[k]}
            onCheckedChange={(v) => setState((p) => ({ ...p, [k]: v }))}
          />
        </div>
      ))}
      <div>
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </div>
  );
}
