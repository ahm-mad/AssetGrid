"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import {
  runInventoryImport,
  runBuildingImport,
  runMarinaImport,
  runCustomersImport,
} from "@/lib/import/actions";
import type { ImportOutcome } from "@/lib/import/parse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Runner = (form: FormData) => Promise<ImportOutcome>;

const PANELS: {
  key: keyof Perms;
  title: string;
  description: string;
  columns: string;
  run: Runner;
}[] = [
  {
    key: "inventory",
    title: "Inventory devices",
    description: "One container per file; devices matched on dev EUI or xNID.",
    columns:
      "SENSOR NAME, DEVICE TYPE, XNID, T-CODE, SERIAL NUMBER, DEVEUI, APPEUI, APPKEY, DEVADDR, NWKSKEY, APPSKEY, PART NUMBER, PRODUCT NAME (+ optional CONTAINER_ID, ADMINEMAIL)",
    run: runInventoryImport,
  },
  {
    key: "building",
    title: "Buildings",
    description: "Floors → units → areas → sites, grouped by building_code.",
    columns:
      "Floor, Name, Unit, Room, Area, End-Point, Interface, Accessory, xNID, building_code, CustomerEmail",
    run: runBuildingImport,
  },
  {
    key: "marina",
    title: "Marinas",
    description: "Marina → dock → slip, plus optional boat / reservation / device layers.",
    columns:
      "marina_code, Dock Name, Slip Name/ID, Slip Status (+ optional Customer Email, xNID, Boat Name, LOA (ft/m), …)",
    run: runMarinaImport,
  },
  {
    key: "customers",
    title: "Customers",
    description: "Creates Customer-role accounts + contact details.",
    columns:
      "First Name, Last Name, Email, Residential (0/1), Xnid (+ optional Phone Number, Address 1/2, City, State, Country, Zip Code, Notification Email/Phone Number)",
    run: runCustomersImport,
  },
];

export interface Perms {
  inventory: boolean;
  building: boolean;
  marina: boolean;
  customers: boolean;
}

export function ImportPanels({ perms }: { perms: Perms }) {
  return (
    <div className="grid gap-4">
      {PANELS.filter((p) => perms[p.key]).map(({ key, ...p }) => (
        <ImportPanel key={key} {...p} />
      ))}
    </div>
  );
}

function ImportPanel({
  title,
  description,
  columns,
  run,
}: {
  title: string;
  description: string;
  columns: string;
  run: Runner;
}) {
  const [pending, start] = React.useTransition();
  const [result, setResult] = React.useState<ImportOutcome | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      toast.error("Choose a CSV file first.");
      return;
    }
    start(async () => {
      setResult(null);
      const res = await run(form);
      setResult(res);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-muted-foreground text-xs">
          <span className="font-medium">Columns:</span> {columns}
        </p>
        <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            name="file"
            accept=".csv,text/csv"
            className="text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm"
          />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Importing…" : "Import"}
          </Button>
        </form>

        {result ? (
          <div className="grid gap-2 rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap gap-4">
              <span>
                <span className="text-muted-foreground">Created:</span> {result.inserted}
              </span>
              {result.updated > 0 ? (
                <span>
                  <span className="text-muted-foreground">Updated:</span> {result.updated}
                </span>
              ) : null}
              <span>
                <span className="text-muted-foreground">Skipped:</span> {result.skipped}
              </span>
              {result.warnings.length > 0 ? (
                <span>
                  <span className="text-muted-foreground">Warnings:</span> {result.warnings.length}
                </span>
              ) : null}
            </div>
            {result.errorReportUrl ? (
              <Button
                size="sm"
                variant="outline"
                render={<Link href={result.errorReportUrl} target="_blank" />}
              >
                Download error report
              </Button>
            ) : null}
            {result.errors.slice(0, 8).map((err, i) => (
              <div key={i} className="text-muted-foreground text-xs">
                Row {err.row}: {err.message}
              </div>
            ))}
            {result.errors.length > 8 ? (
              <div className="text-muted-foreground text-xs">
                …and {result.errors.length - 8} more (see the report).
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
