"use client";

import { useDeviceTelemetry } from "@/components/realtime/use-telemetry";
import { StatusLabel } from "@/components/charts/status-dot";

/**
 * A small live tile for the device detail page — updates in place whenever a
 * new telemetry row arrives for this device over Supabase Realtime.
 */
export function LiveReadingCard({
  userDeviceId,
  initialAt,
}: {
  userDeviceId: number;
  initialAt: string | null;
}) {
  const { latest, connected } = useDeviceTelemetry(userDeviceId);

  const at = latest?.createdAt ?? initialAt;
  const fields: [string, number | boolean][] = latest
    ? ([
        ["Temperature", latest.temperature],
        ["Humidity", latest.humidity],
        ["Voltage", latest.voltage],
        ["Current", latest.current],
        ["Active power", latest.activePower],
        ["External input", latest.externalInput],
        ["Motion", latest.move],
        ["Reed", latest.reedState],
      ] as [string, number | boolean | null][]).filter(
        (entry): entry is [string, number | boolean] => entry[1] !== null && entry[1] !== undefined,
      )
    : [];

  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">Live</span>
        <StatusLabel status={connected ? "online" : "offline"}>{connected ? "Streaming" : "Connecting…"}</StatusLabel>
      </div>
      {latest ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {fields.map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-mono">{typeof v === "boolean" ? (v ? "yes" : "no") : String(v)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-muted-foreground">
          Waiting for the next packet{at ? ` — last seen ${new Date(at).toLocaleString()}` : ""}.
        </p>
      )}
    </div>
  );
}
