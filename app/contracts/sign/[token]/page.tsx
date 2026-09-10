import { notFound } from "next/navigation";

import { getSignTokenPreview } from "@/lib/marina/pms/contracts-public";

import { SignForm } from "./sign-form";

export const metadata = { title: "Sign contract" };
export const dynamic = "force-dynamic";

export default async function ContractSignPage({
  params,
}: PageProps<"/contracts/sign/[token]">) {
  const { token } = await params;
  const preview = await getSignTokenPreview(token);
  if (!preview) notFound();

  const terms = preview.structuredTerms ?? {};

  return (
    <main className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
      <header>
        <h1 className="text-xl font-semibold">
          {preview.kind === "amendment" ? "Contract amendment" : "Marina slip contract"}
        </h1>
        <p className="text-sm text-neutral-500">
          {preview.marinaName} · contract #{preview.contractId}
        </p>
      </header>

      {!preview.valid ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {preview.reason ?? "This signing link is no longer valid."}
        </div>
      ) : null}

      <section className="grid gap-2 rounded-lg border p-4 text-sm">
        <Row label="Customer" value={preview.customerName ?? "—"} />
        <Row label="Boat" value={preview.boatName ?? "—"} />
        <Row label="Slip" value={preview.slipName ?? "—"} />
        <Row label="Term" value={`${preview.startDate ?? "—"} to ${preview.endDate ?? "—"}`} />
        <Row label="Monthly rate" value={`$${preview.monthlyRate.toFixed(2)}`} />
      </section>

      {preview.amendment ? (
        <section className="grid gap-2 rounded-lg border p-4 text-sm">
          <h2 className="font-medium">Amendment: {preview.amendment.type.replace(/_/g, " ")}</h2>
          {preview.amendment.description ? <p>{preview.amendment.description}</p> : null}
          {preview.amendment.newAmount != null ? (
            <Row label="New monthly rate" value={`$${preview.amendment.newAmount.toFixed(2)}`} />
          ) : null}
          {preview.amendment.newStartDate ? (
            <Row label="New start" value={preview.amendment.newStartDate} />
          ) : null}
          {preview.amendment.newEndDate ? (
            <Row label="New end" value={preview.amendment.newEndDate} />
          ) : null}
        </section>
      ) : (
        <section className="grid gap-3 rounded-lg border p-4 text-sm">
          <h2 className="font-medium">Terms &amp; conditions</h2>
          {Object.entries(terms)
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <div className="font-medium capitalize">{k.replace(/_/g, " ")}</div>
                <div className="text-neutral-600">{v}</div>
              </div>
            ))}
        </section>
      )}

      {preview.valid ? <SignForm token={token} kind={preview.kind} /> : null}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
