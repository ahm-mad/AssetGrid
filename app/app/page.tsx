import { getCurrentUser } from "@/lib/auth/dal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const granted = user?.permissions.filter((p) => p.can_read) ?? [];

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ""}.
        </p>
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

      <p className="text-muted-foreground text-sm">
        Domain slices land here one at a time (see <code>docs/progress/task.md</code>).
      </p>
    </div>
  );
}
