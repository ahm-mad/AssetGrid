import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/page-guards";
import { can } from "@/lib/auth/permissions";
import { listPlans } from "@/lib/billing/data";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { Button } from "@/components/ui/button";

import { PlansClient } from "./plans-client";

export const metadata = { title: "Plans" };

export default async function PlansPage() {
  const viewer = await requirePagePermission("commerce", "read", { allowCustomer: true });
  const plans = await listPlans(true);

  const canCreate = viewer.isSuperAdmin || viewer.isCustomer || can(viewer.permissions, "commerce", "create");
  const canEdit = viewer.isSuperAdmin || viewer.isCustomer || can(viewer.permissions, "commerce", "update");
  const canDelete = viewer.isSuperAdmin || viewer.isCustomer || can(viewer.permissions, "commerce", "delete");

  return (
    <div className="grid gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/app/billing" />}>
          ← Billing
        </Button>
        <h1 className="text-lg font-semibold">Plans</h1>
        <p className="text-muted-foreground text-sm">
          Subscription / activation plans. {isStripeConfigured()
            ? "Saving creates/updates the matching Stripe product + price."
            : "Stripe is not configured — plans are stored without Stripe product/price ids."}
        </p>
      </div>

      <PlansClient
        rows={plans}
        stripeConfigured={isStripeConfigured()}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  );
}
