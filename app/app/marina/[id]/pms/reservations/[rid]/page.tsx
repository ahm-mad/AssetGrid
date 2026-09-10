import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { getReservation } from "@/lib/marina/pms/data";
import { getFolio } from "@/lib/marina/pms/billing-data";
import { createClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/button";

import { ReservationDetailClient } from "./reservation-detail-client";

export const metadata = { title: "Reservation" };

export default async function ReservationDetailPage({
  params,
}: PageProps<"/app/marina/[id]/pms/reservations/[rid]">) {
  const viewer = await requireUser();
  const marinaRead =
    viewer.isSuperAdmin || viewer.isCustomer || can(viewer.permissions, "marina", "read");
  if (!marinaRead) notFound();

  const { id, rid } = await params;
  const marinaId = Number(id);
  const reservationId = Number(rid);
  if (!Number.isInteger(marinaId) || !Number.isInteger(reservationId)) notFound();

  const reservation = await getReservation(reservationId);
  if (!reservation || reservation.marinaId !== marinaId) notFound();

  const supabase = await createClient();
  const { data: slips } = await supabase
    .from("slips")
    .select("id, name, dock_id, min_loa, max_loa, is_active")
    .eq("marina_id", marinaId)
    .order("name");

  const canWrite = viewer.isSuperAdmin || can(viewer.permissions, "marina", "create");
  const folio = reservation.stay ? await getFolio(reservation.stay.id) : null;

  return (
    <div className="grid gap-4">
      <div>
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/app/marina/${marinaId}/pms`} />}
        >
          ← Property management
        </Button>
        <h1 className="text-lg font-semibold">
          Reservation #{reservation.id}
          <span className="text-muted-foreground ml-2 font-mono text-xs">{reservation.xnid}</span>
        </h1>
      </div>

      <ReservationDetailClient
        marinaId={marinaId}
        canWrite={canWrite}
        reservation={reservation}
        folio={folio}
        slips={(slips ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          dockId: s.dock_id,
          minLoa: s.min_loa,
          maxLoa: s.max_loa,
          isActive: s.is_active,
        }))}
      />
    </div>
  );
}
