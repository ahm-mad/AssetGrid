import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/page-guards";
import { getCompanyOptions } from "@/lib/companies/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { CreateUserForm } from "./create-user-form";

export const metadata = { title: "New user" };

export default async function NewUserPage() {
  await requirePagePermission("commerce", "create", { allowCustomer: false });
  const companies = await getCompanyOptions();

  return (
    <div className="grid gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/app/customers" />}>
          ← Customers
        </Button>
        <h1 className="text-lg font-semibold">New user</h1>
        <p className="text-muted-foreground text-sm">
          Create a company principal (admin / dealer / partner) or a manager under an existing
          company. An invite email is sent when SMTP is configured.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateUserForm companies={companies} />
        </CardContent>
      </Card>
    </div>
  );
}
