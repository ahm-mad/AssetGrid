import { requirePagePermission } from "@/lib/auth/page-guards";
import { can } from "@/lib/auth/permissions";
import { getRoleMatrix } from "@/lib/roles/data";

import { RolesMatrix } from "./roles-matrix";

export const metadata = { title: "Roles & access" };

export default async function RolesPage() {
  const user = await requirePagePermission("roles_permissions", "read");
  const roles = await getRoleMatrix();
  const canEdit = user.isSuperAdmin || can(user.permissions, "roles_permissions", "update");

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-lg font-semibold">Roles &amp; access</h1>
        <p className="text-muted-foreground text-sm">
          What each role can do, per module. {canEdit ? "" : "Read-only for your role."}
        </p>
      </div>
      <RolesMatrix roles={roles} canEdit={canEdit} />
    </div>
  );
}
