import { requireUser } from "@/lib/auth/dal";
import { notFound } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { listRules, getRuleFormOptions } from "@/lib/rules/data";

import { RulesClient } from "./rules-client";

export const metadata = { title: "Rule builder" };

export default async function RulesPage() {
  const viewer = await requireUser();
  const allowed =
    viewer.isSuperAdmin || viewer.isCustomer || can(viewer.permissions, "rulebuilder", "read");
  if (!allowed) notFound();

  // A plain user sees their own rules; a rulebuilder reader sees all.
  const scopeToSelf = viewer.isCustomer && !can(viewer.permissions, "rulebuilder", "read");
  const [rules, options] = await Promise.all([
    listRules(scopeToSelf ? { userId: viewer.id } : {}),
    getRuleFormOptions(viewer.id),
  ]);

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-lg font-semibold">Rule builder</h1>
        <p className="text-muted-foreground text-sm">
          Custom alert rules — a rule fires when one of its devices reports a packet that
          matches the condition tree.
        </p>
      </div>
      <RulesClient rows={rules} options={options} showOwner={!scopeToSelf} />
    </div>
  );
}
