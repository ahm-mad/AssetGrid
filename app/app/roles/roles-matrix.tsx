"use client"

import * as React from "react"
import { toast } from "sonner"

import type { RoleMatrixRow } from "@/lib/roles/data"
import type { PermissionAction } from "@/lib/auth/types"
import { setRolePermission } from "@/lib/roles/actions"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

const ACTIONS: PermissionAction[] = ["read", "create", "update", "delete"]

function keyOf(m: number, a: PermissionAction) {
  return `${m}:${a}`
}

export function RolesMatrix({ roles, canEdit }: { roles: RoleMatrixRow[]; canEdit: boolean }) {
  const [pending, startTransition] = React.useTransition()
  const [busy, setBusy] = React.useState<string | null>(null)
  // optimistic override: `${roleId}:${moduleId}:${action}` -> boolean
  const [overrides, setOverrides] = React.useState<Record<string, boolean>>({})

  function toggle(roleId: number, moduleId: number, action: PermissionAction, next: boolean) {
    const oKey = `${roleId}:${keyOf(moduleId, action)}`
    setOverrides((o) => ({ ...o, [oKey]: next }))
    setBusy(oKey)
    startTransition(async () => {
      const res = await setRolePermission({ roleTypeId: roleId, moduleId, action, value: next })
      setBusy(null)
      if (!res.ok) {
        setOverrides((o) => {
          const { [oKey]: _drop, ...rest } = o
          return rest
        })
        toast.error(res.error ?? "Could not save")
      }
    })
  }

  return (
    <Tabs defaultValue={String(roles[0]?.id ?? 1)}>
      <TabsList className="flex-wrap">
        {roles.map((r) => (
          <TabsTrigger key={r.id} value={String(r.id)}>
            {r.title}
          </TabsTrigger>
        ))}
      </TabsList>

      {roles.map((role) => {
        const editable = canEdit && role.id !== 1
        return (
          <TabsContent key={role.id} value={String(role.id)}>
            {role.id === 1 ? (
              <p className="text-muted-foreground mb-3 text-sm">
                Super Admin bypasses every permission and scope check — this matrix is
                informational.
              </p>
            ) : null}
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-56">Module</TableHead>
                    {ACTIONS.map((a) => (
                      <TableHead key={a} className="text-center capitalize">
                        {a}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {role.modules.map((m) => (
                    <TableRow key={m.moduleId}>
                      <TableCell className="font-medium">{m.code}</TableCell>
                      {ACTIONS.map((a) => {
                        const oKey = `${role.id}:${keyOf(m.moduleId, a)}`
                        const base =
                          a === "read"
                            ? m.canRead
                            : a === "create"
                              ? m.canCreate
                              : a === "update"
                                ? m.canUpdate
                                : m.canDelete
                        const checked = overrides[oKey] ?? base
                        return (
                          <TableCell key={a} className="text-center">
                            <Switch
                              checked={checked}
                              disabled={!editable || (pending && busy === oKey)}
                              onCheckedChange={(next) => toggle(role.id, m.moduleId, a, next)}
                              aria-label={`${role.title} ${m.code} ${a}`}
                            />
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )
      })}
    </Tabs>
  )
}
