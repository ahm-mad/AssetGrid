import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/page-guards";
import {
  listPlans,
  getActivationUserOptions,
  listActivatableUserDevices,
} from "@/lib/billing/data";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { Button } from "@/components/ui/button";

import { StartActivationForm } from "./start-activation-form";

export const metadata = { title: "Start activation" };

export default async function StartActivationPage({
  searchParams,
}: PageProps<"/app/billing/new">) {
  await requirePagePermission("commerce", "create", { allowCustomer: false });

  const sp = await searchParams;
  const userId = typeof sp.user === "string" ? sp.user : null;

  const [plans, users, devices] = await Promise.all([
    listPlans(),
    getActivationUserOptions(),
    userId ? listActivatableUserDevices(userId) : Promise.resolve([]),
  ]);

  return (
    <div className="grid max-w-2xl gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/app/billing" />}>
          ← Billing
        </Button>
        <h1 className="text-lg font-semibold">Start activation</h1>
        <p className="text-muted-foreground text-sm">
          Create an activation attempt for a user&apos;s devices.{" "}
          {isStripeConfigured()
            ? "A Stripe Checkout link is returned for direct / dealer-assisted modes."
            : "Stripe is not configured — only dealer-billed activation will complete."}
        </p>
      </div>

      <StartActivationForm
        plans={plans.map((p) => ({
          id: p.id,
          label: `${p.name} (${p.planCode})`,
          hasStripePrice: !!p.stripePriceId,
        }))}
        users={users}
        selectedUserId={userId}
        devices={devices}
        stripeConfigured={isStripeConfigured()}
      />
    </div>
  );
}
