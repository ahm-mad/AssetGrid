import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { getUserDevice } from "@/lib/devices/data";
import { getDeviceTelemetrySeries } from "@/lib/telemetry/data";
import { UI_MOCK } from "@/lib/mock/enabled";
import { getMockDeviceBundle, getMockTelemetrySeries } from "@/lib/mock/device-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart } from "@/components/charts/line-chart";
import { StatusLabel } from "@/components/charts/status-dot";

import { DeviceDetail } from "./device-detail";

export const metadata = { title: "Device" };

export default async function DeviceDetailPage({ params }: PageProps<"/app/devices/[id]">) {
  const viewer = await requireUser();
  const allowed =
    viewer.isSuperAdmin || viewer.isCustomer || can(viewer.permissions, "inventory", "read");
  if (!allowed) notFound();

  const { id } = await params;
  const deviceId = Number(id);
  if (!Number.isInteger(deviceId)) notFound();

  const bundle = UI_MOCK ? getMockDeviceBundle(deviceId) : await getUserDevice(deviceId);
  if (!bundle) notFound();

  const canControl = viewer.isSuperAdmin || can(viewer.permissions, "inventory", "update");
  const canDelete = viewer.isSuperAdmin || can(viewer.permissions, "inventory", "delete");

  const { device } = bundle;
  const series = UI_MOCK ? getMockTelemetrySeries(device.id) : await getDeviceTelemetrySeries(device.id, "weekly", 250);

  const hasPower = series.some((p) => p.activePower != null);
  const hasTemp = series.some((p) => p.temperature != null);
  const pointLabel = (iso: string) =>
    new Date(iso).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
  const chartData = hasPower
    ? series.map((p) => ({ label: pointLabel(p.createdAt), value: p.activePower ?? 0 })).reverse()
    : hasTemp
      ? series.map((p) => ({ label: pointLabel(p.createdAt), value: p.temperature ?? 0 })).reverse()
      : [];

  return (
    <div className="grid max-w-3xl gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/app/devices" />}>
          ← Devices
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">{device.deviceName ?? `Device #${device.id}`}</h1>
        <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          <StatusLabel status={device.status === "captured" ? "online" : "critical"}>
            {device.status === "captured" ? "Online" : "Offline"}
          </StatusLabel>
          {device.productName ? <span>{device.productName}</span> : null}
          {device.ownerName ? <span>· {device.ownerName}</span> : null}
          {device.devEui ? <span className="font-mono">· {device.devEui}</span> : null}
        </p>
      </div>

      {chartData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{hasPower ? "Power draw" : "Temperature"}</CardTitle>
            <CardDescription>Last 7 days of telemetry for this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <LineChart data={chartData} unit={hasPower ? " W" : "°F"} color="var(--chart-1)" />
          </CardContent>
        </Card>
      ) : null}

      <DeviceDetail bundle={bundle} canControl={canControl} canDelete={canDelete} />
    </div>
  );
}
