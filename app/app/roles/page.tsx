import { requirePagePermission } from "@/lib/auth/page-guards";
import { can } from "@/lib/auth/permissions";
import { getRoleMatrix } from "@/lib/roles/data";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { RolesMatrix } from "./roles-matrix";
import { ManageRoles } from "./manage-roles";

export const metadata = { title: "Roles & access" };

export default async function RolesPage() {
  const user = await requirePagePermission("roles_permissions", "read");
  const roles = await getRoleMatrix();
  const canEdit = user.isSuperAdmin || can(user.permissions, "roles_permissions", "update");
  const canManage = user.isSuperAdmin || can(user.permissions, "roles_permissions", "create");

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-lg font-semibold">Roles &amp; access</h1>
        <p className="text-muted-foreground text-sm">
          What each role can do, per module. {canEdit ? "" : "Read-only for your role."}
        </p>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manage roles</CardTitle>
          </CardHeader>
          <CardContent>
            <ManageRoles roles={roles.map((r) => ({ id: r.id, title: r.title }))} />
          </CardContent>
        </Card>
      ) : null}

      <RolesMatrix roles={roles} canEdit={canEdit} />
    </div>
  );
}
