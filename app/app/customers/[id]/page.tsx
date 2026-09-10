import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { getUserDetail, getRoleOptions } from "@/lib/users/detail";
import { getCompanyOptions } from "@/lib/companies/data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { UserBasicsForm } from "./user-basics-form";
import { PermissionOverrides } from "./permission-overrides";
import { UserActions } from "./user-actions";
import { UserScopesEditor } from "./user-scopes";

export const metadata = { title: "User" };

export default async function UserDetailPage({ params }: PageProps<"/app/customers/[id]">) {
  const viewer = await requireUser();
  if (!viewer.isSuperAdmin && !can(viewer.permissions, "commerce", "read")) notFound();

  const { id } = await params;
  const user = await getUserDetail(id);
  if (!user) notFound();

  const [roles, companies] = await Promise.all([getRoleOptions(), getCompanyOptions()]);

  const canEditBasics = viewer.isSuperAdmin || can(viewer.permissions, "commerce", "update");
  const canEditPerms = viewer.isSuperAdmin || can(viewer.permissions, "roles_permissions", "update");
  const canDelete = viewer.isSuperAdmin || can(viewer.permissions, "commerce", "delete");
  const canImpersonate =
    !viewer.isCustomer && viewer.id !== user.id && (user.roleTitle !== "Super Admin" || viewer.isSuperAdmin);

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || user.id;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" render={<Link href="/app/customers" />}>
            ← Customers
          </Button>
          <h1 className="text-lg font-semibold">{name}</h1>
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Badge variant="secondary">{user.roleTitle}</Badge>
            {user.companyName ? <span>{user.companyName}</span> : null}
            {user.deletedAt ? <Badge variant="outline">deleted</Badge> : null}
            {user.emailConfirmedAt ? null : <Badge variant="outline">unverified</Badge>}
          </p>
        </div>
        <UserActions
          userId={user.id}
          isDeleted={!!user.deletedAt}
          canImpersonate={canImpersonate}
          canDelete={canDelete}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>
            {user.xnid} · joined {new Date(user.createdAt).toLocaleDateString()}
            {user.lastSignInAt
              ? ` · last sign-in ${new Date(user.lastSignInAt).toLocaleDateString()}`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserBasicsForm user={user} roles={roles} companies={companies} canEdit={canEditBasics} />
        </CardContent>
      </Card>

      {(user.details?.containerCodes.length || user.details?.inventoryDeviceIds.length) ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scope inputs</CardTitle>
            <CardDescription>Role-specific device ownership (from the old detail_users JSON).</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {user.details?.containerCodes.length ? (
              <p>Container codes: {user.details.containerCodes.join(", ")}</p>
            ) : null}
            {user.details?.inventoryDeviceIds.length ? (
              <p>Inventory device ids: {user.details.inventoryDeviceIds.join(", ")}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permission overrides</CardTitle>
        </CardHeader>
        <CardContent>
          <PermissionOverrides
            userId={user.id}
            rows={user.permissionOverrides}
            canEdit={canEditPerms}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data scopes</CardTitle>
          <CardDescription>Which resources this user is limited to.</CardDescription>
        </CardHeader>
        <CardContent>
          <UserScopesEditor userId={user.id} scopes={user.scopes} canEdit={canEditPerms} />
        </CardContent>
      </Card>
    </div>
  );
}
