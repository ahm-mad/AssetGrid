"use client"

import * as React from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import {
  saveNotifie,
  deleteNotifie,
  saveDeviceType,
  deleteDeviceType,
} from "@/lib/catalog/actions"
import type {
  AppRow,
  DeviceTypeRow,
  NotifieRow,
  ProductRow,
  XupRow,
} from "@/lib/catalog/data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// --------------------------------------------------------------------------
export function NotifiesTab({
  rows,
  canEdit,
}: {
  rows: NotifieRow[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, start] = React.useTransition()
  const [name, setName] = React.useState("")

  return (
    <div className="grid gap-3">
      {canEdit ? (
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New notifie name"
            className="max-w-xs"
          />
          <Button
            size="sm"
            disabled={pending || !name.trim()}
            onClick={() =>
              start(async () => {
                const r = await saveNotifie({ name })
                if (r.ok) {
                  setName("")
                  router.refresh()
                } else toast.error(r.error ?? "Failed")
              })
            }
          >
            Add
          </Button>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((n) => (
              <TableRow key={n.id}>
                <TableCell className="text-muted-foreground">{n.id}</TableCell>
                <TableCell className="font-medium">{n.name ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await deleteNotifie(n.id)
                          if (r.ok) router.refresh()
                          else toast.error(r.error ?? "Failed")
                        })
                      }
                    >
                      Delete
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------
export function DeviceTypesTab({
  rows,
  canEdit,
}: {
  rows: DeviceTypeRow[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, start] = React.useTransition()
  const [name, setName] = React.useState("")

  return (
    <div className="grid gap-3">
      {canEdit ? (
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New device type"
            className="max-w-xs"
          />
          <Button
            size="sm"
            disabled={pending || !name.trim()}
            onClick={() =>
              start(async () => {
                const r = await saveDeviceType({ name, description: "" })
                if (r.ok) {
                  setName("")
                  router.refresh()
                } else toast.error(r.error ?? "Failed")
              })
            }
          >
            Add
          </Button>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="text-muted-foreground">{d.id}</TableCell>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell className="text-muted-foreground max-w-md truncate">
                  {d.description ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await deleteDeviceType(d.id)
                          if (r.ok) router.refresh()
                          else toast.error(r.error ?? "Failed")
                        })
                      }
                    >
                      Delete
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------
export function AppsTab({ rows, xups }: { rows: AppRow[]; xups: XupRow[] }) {
  const xupCode = new Map(xups.map((x) => [x.id, x.code]))
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>App</TableHead>
            <TableHead>xUPs</TableHead>
            <TableHead>Optional params</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">{a.appName}</TableCell>
              <TableCell className="flex flex-wrap gap-1">
                {a.xupIds.map((id) => (
                  <Badge key={id} variant="secondary">
                    {xupCode.get(id) ?? id}
                  </Badge>
                ))}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {a.optionalParameters ? JSON.stringify(a.optionalParameters) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// --------------------------------------------------------------------------
export function ProductsTab({ rows }: { rows: ProductRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No products yet — these are loaded by the data migration (Phase N+1).
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Device type</TableHead>
            <TableHead>Notifie</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.productName ?? "—"}</TableCell>
              <TableCell>{p.sku ?? "—"}</TableCell>
              <TableCell>{p.deviceTypeName ?? "—"}</TableCell>
              <TableCell>{p.notifieName ?? "—"}</TableCell>
              <TableCell>{p.companyName ?? "—"}</TableCell>
              <TableCell>{p.status ? "Yes" : "No"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
