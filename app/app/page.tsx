import { getCurrentUser } from "@/lib/auth/dal";
import { getDashboardSummary } from "@/lib/analytics/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/charts/stat-tile";
import { LineChart } from "@/components/charts/line-chart";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const granted = user?.permissions.filter((p) => p.can_read) ?? [];
  const summary = await getDashboardSummary();

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ""}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Devices" value={summary.deviceCount} />
        <StatTile label="Open alerts" value={summary.openAlertCount} status={summary.openAlertCount > 0 ? "warning" : undefined} />
        <StatTile label="Buildings" value={summary.buildingCount} />
        <StatTile label="Marinas" value={summary.marinaCount} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Telemetry activity</CardTitle>
          <CardDescription>Packets received per hour, most recent ingestion window.</CardDescription>
        </CardHeader>
        <CardContent>
          {summary.activity.length === 0 ? (
            <p className="text-muted-foreground text-sm">No telemetry in range.</p>
          ) : (
            <LineChart data={summary.activity} unit=" packets" />
          )}
        </CardContent>
      </Card>

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
