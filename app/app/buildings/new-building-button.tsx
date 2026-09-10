"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { saveBuilding } from "@/lib/buildings/actions";
import type { CompanyOption } from "@/lib/companies/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TEXT_FIELDS: [string, string][] = [
  ["location_code", "Location code * (3)"],
  ["county_code", "County code * (2)"],
  ["building_id", "Building id * (≤10)"],
  ["city_code", "City code * (7)"],
  ["on_net_type", "On-net type *"],
  ["structure_category", "Structure category *"],
  ["street_address", "Street address"],
  ["city", "City"],
  ["state_province", "State / province"],
  ["country", "Country"],
  ["postal_code", "Postal code"],
];

export function NewBuildingButton({ companies }: { companies: CompanyOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [companyId, setCompanyId] = React.useState("none");
  const [err, setErr] = React.useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    const payload: Record<string, unknown> = { company_id: companyId === "none" ? "" : companyId };
    for (const [k] of TEXT_FIELDS) payload[k] = fd.get(k);
    payload.latitude = fd.get("latitude");
    payload.longitude = fd.get("longitude");
    start(async () => {
      const res = await saveBuilding(payload);
      if (res.ok) {
        toast.success("Building created");
        setOpen(false);
        if (res.id) router.push(`/app/buildings/${res.id}`);
      } else setErr(res.error ?? (res.fieldErrors ? "Check the fields." : "Could not save"));
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        New building
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New building</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
          <div className="grid gap-2">
            <Label>Company</Label>
            <Select value={companyId} onValueChange={(v) => setCompanyId(v ?? "none")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">(your company)</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {TEXT_FIELDS.map(([k, label]) => (
              <div key={k} className="grid gap-2">
                <Label htmlFor={k}>{label}</Label>
                <Input id={k} name={k} />
              </div>
            ))}
            <div className="grid gap-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input id="latitude" name="latitude" type="number" step="any" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input id="longitude" name="longitude" type="number" step="any" />
            </div>
          </div>
          {err ? <p className="text-destructive text-sm">{err}</p> : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
