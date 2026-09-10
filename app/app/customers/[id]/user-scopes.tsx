"use client"

import * as React from "react"
import { toast } from "sonner"

import { setUserScope, clearUserScope, SCOPE_ENTITIES } from "@/lib/users/scope-actions"
import type { UserScopeRow } from "@/lib/users/detail"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const LABELS: Record<(typeof SCOPE_ENTITIES)[number], string> = {
  building: "Buildings",
  marina: "Marinas",
  inventory: "Inventory devices",
  commerce: "Users (commerce)",
  messaging: "SMS groups",
  rule_builder: "Alert rules",
}

export function UserScopesEditor({
  userId,
  scopes,
  canEdit,
}: {
  userId: string
  scopes: UserScopeRow[]
  canEdit: boolean
}) {
  const byEntity = new Map(scopes.map((s) => [s.entityType, s]))
  const [pending, start] = React.useTransition()
  const [busy, setBusy] = React.useState<string | null>(null)

  function save(entity: (typeof SCOPE_ENTITIES)[number], raw: string) {
    const ids = raw
      .split(/[\s,]+/)
      .map((x) => Number(x))
      .filter((n) => Number.isInteger(n) && n > 0)
    setBusy(entity)
    start(async () => {
      const res = await setUserScope({ userId, entityType: entity, assetIds: ids })
      setBusy(null)
      if (res.ok) toast.success(`${LABELS[entity]} scope saved`)
      else toast.error(res.error ?? "Could not save")
    })
  }

  function clear(entity: string) {
    setBusy(`clear:${entity}`)
    start(async () => {
      const res = await clearUserScope(userId, entity)
      setBusy(null)
      if (res.ok) toast.success("Scope removed (unrestricted)")
      else toast.error(res.error ?? "Could not clear")
    })
  }

  return (
    <div className="grid gap-4">
      <p className="text-muted-foreground text-sm">
        No entry = unrestricted for that entity. An entry with no ids = locked out. Enter the
        asset ids (comma or space separated). Labels appear once the buildings / marina slices
        land.
      </p>
      {SCOPE_ENTITIES.map((entity) => {
        const current = byEntity.get(entity)
        return (
          <div key={entity} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
            <Label>{LABELS[entity]}</Label>
            <Input
              id={`scope-${entity}`}
              defaultValue={current ? current.assetIds.join(", ") : ""}
              placeholder="e.g. 12, 15, 20"
              disabled={!canEdit}
            />
            {canEdit ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending && busy === entity}
                  onClick={() => {
                    const el = document.getElementById(
                      `scope-${entity}`,
                    ) as HTMLInputElement | null
                    save(entity, el?.value ?? "")
                  }}
                >
                  Save
                </Button>
                {current ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending && busy === `clear:${entity}`}
                    onClick={() => clear(entity)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
