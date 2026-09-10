"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div>
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground text-sm">
          {error.digest ? `Reference: ${error.digest}` : "An unexpected error occurred."}
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
