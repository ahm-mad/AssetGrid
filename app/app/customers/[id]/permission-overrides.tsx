"use client"

import * as React from "react"
import { toast } from "sonner"

import {
  setUserPermissionOverride,
  clearUserPermissionOverride,
} from "@/lib/users/actions"
import type { UserPermissionOverride } from "@/lib/users/detail"
import type { PermissionAction } from "@/lib/auth/types"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const ACTIONS: PermissionAction[] = ["read", "create", "update", "delete"]

export function PermissionOverrides({
  userId,
  rows,
  canEdit,
}: {
  userId: string
  rows: UserPermissionOverride[]
  canEdit: boolean
}) {
  const [pending, start] = React.useTransition()
  const [busy, setBusy] = React.useState<string | null>(null)

  function toggle(moduleId: number, action: PermissionAction, value: boolean) {
    const k = `${moduleId}:${action}`
    setBusy(k)
    start(async () => {
      const res = await setUserPermissionOverride({ userId, moduleId, action, value })
      setBusy(null)
      if (!res.ok) toast.error(res.error ?? "Could not save")
    })
  }

  function clear(moduleId: number) {
    setBusy(`clear:${moduleId}`)
    start(async () => {
      const res = await clearUserPermissionOverride(userId, moduleId)
      setBusy(null)
      if (!res.ok) toast.error(res.error ?? "Could not clear")
    })
  }

  return (
    <div className="grid gap-2">
      <p className="text-muted-foreground text-sm">
        An override <strong>replaces</strong> the role&apos;s grant for that module entirely.
        Modules without an override fall back to the role.
      </p>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              {ACTIONS.map((a) => (
                <TableHead key={a} className="text-center capitalize">
                  {a}
                </TableHead>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.moduleId} className={r.hasOverride ? "" : "opacity-60"}>
                <TableCell className="font-medium">
                  {r.code}
                  {r.hasOverride ? (
                    <span className="text-primary ml-2 text-xs">override</span>
                  ) : null}
                </TableCell>
                {ACTIONS.map((a) => {
                  const checked =
                    a === "read"
                      ? r.canRead
                      : a === "create"
                        ? r.canCreate
                        : a === "update"
                          ? r.canUpdate
                          : r.canDelete
                  return (
                    <TableCell key={a} className="text-center">
                      <Switch
                        checked={checked}
                        disabled={!canEdit || (pending && busy === `${r.moduleId}:${a}`)}
                        onCheckedChange={(v) => toggle(r.moduleId, a, v)}
                        aria-label={`${r.code} ${a}`}
                      />
                    </TableCell>
                  )
                })}
                <TableCell className="text-right">
                  {r.hasOverride && canEdit ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending && busy === `clear:${r.moduleId}`}
                      onClick={() => clear(r.moduleId)}
                    >
                      Reset
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
