import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/page-guards";
import { getCompanyOptions } from "@/lib/companies/data";
import { UI_MOCK } from "@/lib/mock/enabled";
import { MOCK_COMPANY_OPTIONS } from "@/lib/mock/customers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { CreateUserForm } from "./create-user-form";

export const metadata = { title: "New user" };

export default async function NewUserPage() {
  await requirePagePermission("commerce", "create", { allowCustomer: false });
  const companies = UI_MOCK ? MOCK_COMPANY_OPTIONS : await getCompanyOptions();

  return (
    <div className="grid gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/app/customers" />}>
          ← Customers
        </Button>
        <p className="eyebrow mt-1">Customers · New</p>
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
          <CreateUserForm companies={companies} mock={UI_MOCK} />
        </CardContent>
      </Card>
    </div>
  );
}
