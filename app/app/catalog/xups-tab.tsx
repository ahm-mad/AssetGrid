"use client"

import * as React from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { saveXup, deleteXup } from "@/lib/catalog/actions"
import type { XupRow } from "@/lib/catalog/data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function XupsTab({
  rows,
  canEdit,
  canDelete,
}: {
  rows: XupRow[]
  canEdit: boolean
  canDelete: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<XupRow | null>(null)
  const [pending, startTransition] = React.useTransition()
  const [err, setErr] = React.useState<string | null>(null)

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await saveXup({
        id: editing?.id,
        code: fd.get("code"),
        data_type: fd.get("data_type"),
        version: fd.get("version"),
        description: fd.get("description"),
        format: fd.get("format"),
        units: fd.get("units"),
        label: fd.get("label"),
      })
      if (res.ok) {
        toast.success(editing ? "Updated" : "Created")
        setOpen(false)
        router.refresh()
      } else setErr(res.error ?? "Could not save")
    })
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {rows.length} numbered telemetry channel definitions.
        </p>
        {canEdit ? (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null)
              setErr(null)
              setOpen(true)
            }}
          >
            New xUP
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Data type</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Units</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((x) => (
              <TableRow key={x.id}>
                <TableCell className="font-mono">{x.code}</TableCell>
                <TableCell>{x.dataType}</TableCell>
                <TableCell>{x.version}</TableCell>
                <TableCell>{x.units ?? "—"}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(x)
                        setErr(null)
                        setOpen(true)
                      }}
                    >
                      Edit
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await deleteXup(x.id)
                          if (res.ok) {
                            toast.success("Deleted")
                            router.refresh()
                          } else toast.error(res.error ?? "Could not delete")
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit xUP" : "New xUP"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-3">
            {(
              [
                ["code", "Code *", editing?.code],
                ["data_type", "Data type *", editing?.dataType],
                ["version", "Version *", editing?.version],
                ["units", "Units", editing?.units],
                ["format", "Format", editing?.format],
                ["label", "Label", editing?.label],
                ["description", "Description", editing?.description],
              ] as const
            ).map(([n, l, v]) => (
              <div key={n} className="grid gap-2">
                <Label htmlFor={n}>{l}</Label>
                <Input id={n} name={n} defaultValue={v ?? ""} />
              </div>
            ))}
            {err ? <p className="text-destructive text-sm">{err}</p> : null}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
