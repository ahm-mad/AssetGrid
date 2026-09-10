import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { getMarina } from "@/lib/marina/data";
import { listRatePlans, listReservations, getPmsPickers, getRatePlanOptions } from "@/lib/marina/pms/data";
import { listContracts } from "@/lib/marina/pms/contracts-data";
import { listInvoices, getArAging } from "@/lib/marina/pms/billing-data";
import { getRevenueReport, getOccupancyReport, getArSummary } from "@/lib/marina/pms/reports";
import { getActivationUserOptions } from "@/lib/billing/data";
import { Button } from "@/components/ui/button";

import { PmsHub } from "./pms-hub";

export const metadata = { title: "Marina PMS" };

export default async function MarinaPmsPage({ params }: PageProps<"/app/marina/[id]/pms">) {
  const viewer = await requireUser();
  const marinaRead =
    viewer.isSuperAdmin || viewer.isCustomer || can(viewer.permissions, "marina", "read");
  if (!marinaRead) notFound();

  const { id } = await params;
  const marinaId = Number(id);
  if (!Number.isInteger(marinaId)) notFound();

  const marina = await getMarina(marinaId);
  if (!marina) notFound();

  const [
    ratePlans,
    reservations,
    contracts,
    invoices,
    arAging,
    revenue,
    occupancy,
    arSummary,
    pickers,
    ratePlanOptions,
    users,
  ] = await Promise.all([
    listRatePlans({ marinaId, perPage: 50 }),
    listReservations({ marinaId, perPage: 25 }),
    listContracts({ marinaId, perPage: 25 }),
    listInvoices({ marinaId, perPage: 25 }),
    getArAging(marinaId),
    getRevenueReport({ marinaId }),
    getOccupancyReport({ marinaId }),
    getArSummary(marinaId),
    getPmsPickers(marinaId),
    getRatePlanOptions(marinaId),
    getActivationUserOptions(),
  ]);

  const canWrite = viewer.isSuperAdmin || can(viewer.permissions, "marina", "create");
  const canDelete = viewer.isSuperAdmin || can(viewer.permissions, "marina", "delete");

  return (
    <div className="grid gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link href={`/app/marina/${marinaId}`} />}>
          ← {marina.marinaName ?? marina.marinaCode}
        </Button>
        <h1 className="text-lg font-semibold">Property management</h1>
        <p className="text-muted-foreground text-sm">
          Rate plans, quotes and reservations for this marina.
        </p>
      </div>

      <PmsHub
        marinaId={marinaId}
        canWrite={canWrite}
        canDelete={canDelete}
        ratePlans={ratePlans.rows}
        reservations={reservations.rows}
        contracts={contracts.rows}
        invoices={invoices.rows}
        arAging={arAging}
        revenue={revenue}
        occupancy={occupancy}
        arSummary={arSummary}
        pickers={pickers}
        ratePlanOptions={ratePlanOptions}
        users={users}
      />
    </div>
  );
}
