"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { softDeleteUser, restoreUser } from "@/lib/users/actions"
import { Button } from "@/components/ui/button"

export function UserActions({
  userId,
  isDeleted,
  canImpersonate,
  canDelete,
}: {
  userId: string
  isDeleted: boolean
  canImpersonate: boolean
  canDelete: boolean
}) {
  const router = useRouter()
  const [pending, start] = React.useTransition()

  function impersonate() {
    start(async () => {
      const res = await fetch(`/api/impersonate/${userId}`, { method: "POST" })
      const body = (await res.json()) as { ok: boolean; error?: { message: string } }
      if (!body.ok) {
        toast.error(body.error?.message ?? "Could not impersonate")
        return
      }
      router.push("/app")
      router.refresh()
    })
  }

  function del() {
    start(async () => {
      const res = await softDeleteUser(userId)
      if (res.ok) {
        toast.success("User deleted")
        router.refresh()
      } else toast.error(res.error ?? "Could not delete")
    })
  }

  function undelete() {
    start(async () => {
      const res = await restoreUser(userId)
      if (res.ok) {
        toast.success("User restored")
        router.refresh()
      } else toast.error(res.error ?? "Could not restore")
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canImpersonate && !isDeleted ? (
        <Button variant="outline" disabled={pending} onClick={impersonate}>
          Impersonate
        </Button>
      ) : null}
      {canDelete && !isDeleted ? (
        <Button variant="destructive" disabled={pending} onClick={del}>
          Delete user
        </Button>
      ) : null}
      {canDelete && isDeleted ? (
        <Button variant="outline" disabled={pending} onClick={undelete}>
          Restore user
        </Button>
      ) : null}
    </div>
  )
}
