"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

export function ImpersonationBanner() {
  const router = useRouter()
  const [pending, start] = React.useTransition()

  function returnToAdmin() {
    start(async () => {
      const res = await fetch("/api/impersonate/stop", { method: "POST" })
      const body = (await res.json()) as { ok: boolean; error?: { message: string } }
      if (!body.ok) {
        toast.error(body.error?.message ?? "Could not return")
        if (res.status === 401) router.push("/login")
        return
      }
      router.push("/app")
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <span>Impersonating another user</span>
      <Button
        size="sm"
        variant="outline"
        className="h-6 px-2 text-xs"
        disabled={pending}
        onClick={returnToAdmin}
      >
        {pending ? "Returning…" : "Return to admin"}
      </Button>
    </div>
  )
}
