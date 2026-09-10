"use client"

import * as React from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { saveAttribute, deleteAttribute, type CatalogResult } from "@/lib/catalog/actions"
import type { AttributeRow, NotifieRow, XupRow } from "@/lib/catalog/data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

const COMPARISONS = ["<", ">", "=", "!=", ">=", "<=", "-"]

export function AttributesTab({
  rows,
  notifies,
  xups,
  canEdit,
  canDelete,
}: {
  rows: AttributeRow[]
  notifies: NotifieRow[]
  xups: XupRow[]
  canEdit: boolean
  canDelete: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AttributeRow | null>(null)
  const [pending, startTransition] = React.useTransition()
  const [state, setState] = React.useState<CatalogResult>({ ok: true })
  const [comparison, setComparison] = React.useState("=")
  const [notifieId, setNotifieId] = React.useState("")
  const [xupId, setXupId] = React.useState("none")
  const [checkin, setCheckin] = React.useState(false)

  function openNew() {
    setEditing(null)
    setComparison("=")
    setNotifieId(notifies[0] ? String(notifies[0].id) : "")
    setXupId("none")
    setCheckin(false)
    setState({ ok: true })
    setOpen(true)
  }
  function openEdit(a: AttributeRow) {
    setEditing(a)
    setComparison(a.comparison)
    setNotifieId(String(a.notifieId))
    setXupId(a.xupId ? String(a.xupId) : "none")
    setCheckin(a.checkin)
    setState({ ok: true })
    setOpen(true)
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await saveAttribute({
        id: editing?.id,
        subject: fd.get("subject"),
        alert_message: fd.get("alert_message"),
        threshold: fd.get("threshold"),
        comparison,
        checkin,
        notifie_id: notifieId,
        xup_id: xupId === "none" ? "" : xupId,
        description: fd.get("description"),
        alert_channel: fd.get("alert_channel"),
        neo_event_code: fd.get("neo_event_code"),
      })
      setState(res)
      if (res.ok) {
        toast.success(editing ? "Attribute updated" : "Attribute created")
        setOpen(false)
        router.refresh()
      }
    })
  }

  function remove(id: number) {
    startTransition(async () => {
      const res = await deleteAttribute(id)
      if (res.ok) {
        toast.success("Deleted")
        router.refresh()
      } else toast.error(res.error ?? "Could not delete")
    })
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {rows.length} alert definitions. The ingestion pipeline evaluates these per packet.
        </p>
        {canEdit ? <Button size="sm" onClick={openNew}>New attribute</Button> : null}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Rule</TableHead>
              <TableHead>Notifie</TableHead>
              <TableHead>xUP</TableHead>
              <TableHead>Neo code</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.subject}</TableCell>
                <TableCell className="font-mono text-xs">
                  {a.description ?? "?"} {a.comparison} {a.threshold ?? "?"}
                  {a.checkin ? <Badge variant="outline" className="ml-1">checkin</Badge> : null}
                </TableCell>
                <TableCell>{a.notifieName ?? a.notifieId}</TableCell>
                <TableCell>{a.xupCode ?? "—"}</TableCell>
                <TableCell>{a.neoEventCode ?? "—"}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {canEdit ? (
                    <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                      Edit
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button variant="ghost" size="sm" disabled={pending} onClick={() => remove(a.id)}>
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit attribute" : "New attribute"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input id="subject" name="subject" defaultValue={editing?.subject ?? ""} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Field / description</Label>
              <Input id="description" name="description" defaultValue={editing?.description ?? ""} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Comparison *</Label>
                <Select value={comparison} onValueChange={(v) => setComparison(v ?? "=")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMPARISONS.map((c) => (
                      <SelectItem key={c} value={c}>{c === "-" ? "-  (in range)" : c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="threshold">Threshold</Label>
                <Input id="threshold" name="threshold" defaultValue={editing?.threshold ?? ""} placeholder="e.g. 42 or 28-42" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Notifie *</Label>
                <Select value={notifieId} onValueChange={(v) => setNotifieId(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Pick" /></SelectTrigger>
                  <SelectContent>
                    {notifies.map((n) => (
                      <SelectItem key={n.id} value={String(n.id)}>{n.name ?? `#${n.id}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>xUP</Label>
                <Select value={xupId} onValueChange={(v) => setXupId(v ?? "none")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {xups.map((x) => (
                      <SelectItem key={x.id} value={String(x.id)}>{x.code} · {x.dataType}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="alert_message">Alert message</Label>
              <Input id="alert_message" name="alert_message" defaultValue={editing?.alertMessage ?? ""} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="alert_channel">Alert channel</Label>
                <Input id="alert_channel" name="alert_channel" defaultValue={editing?.alertChannel ?? "0"} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="neo_event_code">Neo event code</Label>
                <Input id="neo_event_code" name="neo_event_code" defaultValue={editing?.neoEventCode ?? ""} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="checkin" checked={checkin} onCheckedChange={setCheckin} />
              <Label htmlFor="checkin">Check-in (normal-state) attribute</Label>
            </div>
            {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
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
