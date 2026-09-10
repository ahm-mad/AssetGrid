"use client";

import * as React from "react";

import { createClient } from "@/utils/supabase/client";

/**
 * Live telemetry for one device via Supabase Realtime (Postgres Changes on
 * `telemetry`). The table's SELECT RLS uses `auth_owns_user_device()`, so the
 * stream a subscriber receives is already filtered to devices they own — this
 * hook adds a server-side `user_device_id` filter on top.
 *
 * Replaces the old public Pusher `sensor-data-channel` (B30).
 */

export interface LiveTelemetryRow {
  id: number;
  createdAt: string;
  temperature: number | null;
  humidity: number | null;
  voltage: number | null;
  current: number | null;
  activePower: number | null;
  externalInput: boolean | null;
  move: boolean | null;
  reedState: number | null;
}

function map(row: Record<string, unknown>): LiveTelemetryRow {
  return {
    id: row.id as number,
    createdAt: row.created_at as string,
    temperature: (row.temperature as number | null) ?? null,
    humidity: (row.humidity as number | null) ?? null,
    voltage: (row.voltage as number | null) ?? null,
    current: (row.current as number | null) ?? null,
    activePower: (row.active_power as number | null) ?? null,
    externalInput: (row.external_input as boolean | null) ?? null,
    move: (row.move as boolean | null) ?? null,
    reedState: (row.reed_state as number | null) ?? null,
  };
}

export function useDeviceTelemetry(userDeviceId: number): {
  latest: LiveTelemetryRow | null;
  connected: boolean;
} {
  const [latest, setLatest] = React.useState<LiveTelemetryRow | null>(null);
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`telemetry:${userDeviceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "telemetry",
          filter: `user_device_id=eq.${userDeviceId}`,
        },
        (payload) => setLatest(map(payload.new as Record<string, unknown>)),
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userDeviceId]);

  return { latest, connected };
}
