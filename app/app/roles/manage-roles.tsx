"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { createRoleType, deleteRoleType } from "@/lib/roles/type-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ManageRoles({
  roles,
}: {
  roles: { id: number; title: string }[]
}) {
  const router = useRouter()
  const [pending, start] = React.useTransition()
  const [title, setTitle] = React.useState("")

  function add() {
    if (!title.trim()) return
    start(async () => {
      const res = await createRoleType({ title, description: "" })
      if (res.ok) {
        setTitle("")
        toast.success("Role created")
        router.refresh()
      } else toast.error(res.error ?? "Could not create")
    })
  }

  function remove(id: number) {
    start(async () => {
      const res = await deleteRoleType(id)
      if (res.ok) {
        toast.success("Role deleted")
        router.refresh()
      } else toast.error(res.error ?? "Could not delete")
    })
  }

  const custom = roles.filter((r) => r.id > 6)

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New role title"
          className="max-w-xs"
        />
        <Button size="sm" disabled={pending || !title.trim()} onClick={add}>
          Add role
        </Button>
      </div>
      {custom.length ? (
        <div className="flex flex-wrap gap-2">
          {custom.map((r) => (
            <span
              key={r.id}
              className="bg-muted flex items-center gap-2 rounded-md px-2 py-1 text-sm"
            >
              {r.title}
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                disabled={pending}
                onClick={() => remove(r.id)}
                aria-label={`Delete ${r.title}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          No custom roles. The 6 built-in roles can be renamed but not deleted.
        </p>
      )}
    </div>
  )
}
