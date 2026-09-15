import { Cpu } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/dal";
import { getDashboardSummary } from "@/lib/analytics/dashboard";
import { UI_MOCK } from "@/lib/mock/enabled";
import { getMockDashboardData, mapRealSummaryToViewModel } from "@/lib/mock/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/charts/stat-tile";
import { LineChart } from "@/components/charts/line-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { RadialGauge } from "@/components/charts/radial-gauge";
import { DonutChart } from "@/components/charts/donut-chart";
import { NetworkMap } from "@/components/charts/network-map";
import { LiveFeed } from "@/components/charts/live-feed";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const granted = user?.permissions.filter((p) => p.can_read) ?? [];
  const data = UI_MOCK ? getMockDashboardData() : mapRealSummaryToViewModel(await getDashboardSummary());
  const { kpis } = data;
  const totalDevices = data.sites.reduce((s, n) => s + n.deviceCount, 0);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">
            Dashboard · <span className="text-foreground">Overview</span>
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Operations overview</h1>
          <p className="text-muted-foreground text-sm">
            {totalDevices} devices · {data.sites.length} sites · {data.deviceTypes.length} product lines · live
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={kpis.devices.label}
          value={kpis.devices.value}
          delta={kpis.devices.delta}
          history={kpis.devices.history}
          status={kpis.devices.status}
        />
        <StatTile
          label={kpis.openAlerts.label}
          value={kpis.openAlerts.value}
          delta={kpis.openAlerts.delta}
          history={kpis.openAlerts.history}
          status={kpis.openAlerts.status}
        />
        <StatTile
          label={kpis.telemetryRate.label}
          value={kpis.telemetryRate.value}
          unit={kpis.telemetryRate.unit}
          delta={kpis.telemetryRate.delta}
          history={kpis.telemetryRate.history}
          status={kpis.telemetryRate.status}
        />
        <div className="flex items-center justify-between rounded-lg border bg-card p-4">
          <div>
            <p className="eyebrow">{kpis.uptime.label}</p>
            <p className="text-status-online mt-1.5 text-xs font-medium">
              {kpis.uptime.delta >= 0 ? "+" : ""}
              {kpis.uptime.delta.toFixed(2)}% vs last period
            </p>
          </div>
          <RadialGauge value={kpis.uptime.value} size={64} stroke={6} color="var(--status-online)" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Telemetry activity</CardTitle>
            <CardDescription>Packets received per hour, most recent ingestion window.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.telemetry.length === 0 ? (
              <p className="text-muted-foreground text-sm">No telemetry in range.</p>
            ) : (
              <LineChart data={data.telemetry} unit=" pkts" color="var(--chart-1)" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live feed</CardTitle>
            <CardDescription>Latest events across the fleet.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.feed.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent events.</p>
            ) : (
              <LiveFeed items={data.feed} />
            )}
          </CardContent>
        </Card>
      </div>

      {data.sites.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fleet by site</CardTitle>
            <CardDescription>Device health per managed account.</CardDescription>
          </CardHeader>
          <CardContent>
            <NetworkMap nodes={data.sites} />
          </CardContent>
        </Card>
      ) : null}

      {data.deviceTypes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fleet by product line</CardTitle>
            <CardDescription>Device health per product / device type.</CardDescription>
          </CardHeader>
          <CardContent>
            <NetworkMap nodes={data.deviceTypes} icon={Cpu} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fleet status</CardTitle>
            <CardDescription>Device health across the whole fleet.</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart data={data.statusBreakdown} centerLabel="Devices" />
          </CardContent>
        </Card>

        {data.byCompany.length > 0 ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Devices by company</CardTitle>
              <CardDescription>Fleet distribution across managed accounts.</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart data={data.byCompany} color="var(--chart-2)" />
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your access</CardTitle>
          <CardDescription>Role: {user?.roleTitle}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {granted.length === 0 ? (
            <span className="text-muted-foreground text-sm">No module permissions.</span>
          ) : (
            granted.map((p) => (
              <Badge key={p.code} variant="secondary">
                {p.code}
              </Badge>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
