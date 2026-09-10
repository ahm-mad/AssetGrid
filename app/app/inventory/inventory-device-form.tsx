"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { saveInventoryDevice } from "@/lib/inventory/actions";
import type {
  InventoryDeviceDetail,
  InventoryDeviceSecrets,
} from "@/lib/inventory/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Options {
  containers: { id: number; code: string }[];
  products: { id: number; name: string; deviceTypeId: number | null }[];
  deviceTypes: { id: number; name: string }[];
}

export function InventoryDeviceForm({
  device,
  secrets,
  options,
  canEdit,
  canSecrets,
}: {
  device: InventoryDeviceDetail | null;
  secrets: InventoryDeviceSecrets | null;
  options: Options;
  canEdit: boolean;
  canSecrets: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [containerId, setContainerId] = React.useState(
    device?.containerId ? String(device.containerId) : "",
  );
  const [productId, setProductId] = React.useState(
    device?.productId ? String(device.productId) : "",
  );
  const [deviceTypeId, setDeviceTypeId] = React.useState(
    device?.deviceTypeId ? String(device.deviceTypeId) : "none",
  );

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    setFieldErrors({});
    start(async () => {
      const res = await saveInventoryDevice({
        id: device?.id,
        name: fd.get("name"),
        description: fd.get("description"),
        dev_eui: fd.get("dev_eui"),
        activation_code: fd.get("activation_code"),
        container_id: containerId,
        product_id: productId,
        device_type_id: deviceTypeId === "none" ? "" : deviceTypeId,
        xnid: fd.get("xnid"),
        t_code: fd.get("t_code"),
        serial_number: fd.get("serial_number"),
        part_number: fd.get("part_number"),
        app_key: canSecrets ? fd.get("app_key") : undefined,
        app_eui: canSecrets ? fd.get("app_eui") : undefined,
        dev_addr: canSecrets ? fd.get("dev_addr") : undefined,
        nwkskey: canSecrets ? fd.get("nwkskey") : undefined,
        appskey: canSecrets ? fd.get("appskey") : undefined,
      });
      if (res.ok) {
        toast.success(device ? "Saved" : "Device created");
        if (!device && res.id) router.push(`/app/inventory/${res.id}`);
        else router.refresh();
      } else {
        setErr(res.error ?? "Could not save");
        setFieldErrors(res.fieldErrors ?? {});
      }
    });
  }

  const fe = (k: string) => fieldErrors[k]?.[0];

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name *" name="name" defaultValue={device?.name} error={fe("name")} disabled={!canEdit} />
        <Field label="Dev EUI *" name="dev_eui" defaultValue={device?.devEui ?? ""} error={fe("dev_eui")} disabled={!canEdit} mono />
        <Field
          label="Activation code"
          name="activation_code"
          defaultValue={device?.activationCode ?? ""}
          error={fe("activation_code")}
          disabled={!canEdit}
          mono
        />
        <Field label="xNID" name="xnid" defaultValue={device?.xnid ?? ""} disabled={!canEdit} mono />
        <Field label="T-code" name="t_code" defaultValue={device?.tCode ?? ""} disabled={!canEdit} />
        <Field label="Serial number" name="serial_number" defaultValue={device?.serialNumber ?? ""} disabled={!canEdit} />
        <Field label="Part number" name="part_number" defaultValue={device?.partNumber ?? ""} disabled={!canEdit} />

        <div className="grid gap-2">
          <Label>Container *</Label>
          <Select value={containerId} onValueChange={(v) => setContainerId(v ?? "")} disabled={!canEdit}>
            <SelectTrigger>
              <SelectValue placeholder="Select a container" />
            </SelectTrigger>
            <SelectContent>
              {options.containers.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fe("container_id") ? <p className="text-destructive text-xs">{fe("container_id")}</p> : null}
        </div>

        <div className="grid gap-2">
          <Label>Product *</Label>
          <Select
            value={productId}
            onValueChange={(v) => {
              setProductId(v ?? "");
              const p = options.products.find((x) => String(x.id) === v);
              if (p?.deviceTypeId) setDeviceTypeId(String(p.deviceTypeId));
            }}
            disabled={!canEdit}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a product" />
            </SelectTrigger>
            <SelectContent>
              {options.products.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fe("product_id") ? <p className="text-destructive text-xs">{fe("product_id")}</p> : null}
        </div>

        <div className="grid gap-2">
          <Label>Device type</Label>
          <Select value={deviceTypeId} onValueChange={(v) => setDeviceTypeId(v ?? "none")} disabled={!canEdit}>
            <SelectTrigger>
              <SelectValue placeholder="Inherit from product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Inherit from product</SelectItem>
              {options.deviceTypes.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" defaultValue={device?.description ?? ""} disabled={!canEdit} />
      </div>

      {canSecrets ? (
        <fieldset className="grid gap-4 rounded-md border p-4 sm:grid-cols-2">
          <legend className="text-sm font-medium">LoRaWAN keys (provisioning only)</legend>
          <Field label="App key" name="app_key" defaultValue={secrets?.appKey ?? ""} disabled={!canEdit} mono />
          <Field label="App EUI" name="app_eui" defaultValue={secrets?.appEui ?? ""} disabled={!canEdit} mono />
          <Field label="Dev addr" name="dev_addr" defaultValue={secrets?.devAddr ?? ""} disabled={!canEdit} mono />
          <Field label="NwkSKey" name="nwkskey" defaultValue={secrets?.nwkskey ?? ""} disabled={!canEdit} mono />
          <Field label="AppSKey" name="appskey" defaultValue={secrets?.appskey ?? ""} disabled={!canEdit} mono />
        </fieldset>
      ) : null}

      {err ? <p className="text-destructive text-sm">{err}</p> : null}

      {canEdit ? (
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : device ? "Save changes" : "Create device"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  error,
  disabled,
  mono,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  error?: string;
  disabled?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        disabled={disabled}
        className={mono ? "font-mono text-sm" : undefined}
      />
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
