"use client"

import * as React from "react"
import { toast } from "sonner"

import { updateUserBasics, type ActionResult } from "@/lib/users/actions"
import type { UserDetail } from "@/lib/users/detail"
import type { CompanyOption } from "@/lib/companies/data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

export function UserBasicsForm({
  user,
  roles,
  companies,
  canEdit,
}: {
  user: UserDetail
  roles: { id: number; title: string }[]
  companies: CompanyOption[]
  canEdit: boolean
}) {
  const [pending, start] = React.useTransition()
  const [state, setState] = React.useState<ActionResult>({ ok: true })
  const [roleId, setRoleId] = React.useState(String(user.roleTypeId))
  const [companyId, setCompanyId] = React.useState(user.companyId ? String(user.companyId) : "none")
  const [residence, setResidence] = React.useState(user.residenceCustomer)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    start(async () => {
      const res = await updateUserBasics({
        userId: user.id,
        first_name: fd.get("first_name"),
        last_name: fd.get("last_name"),
        role_type_id: roleId,
        company_id: companyId === "none" ? "" : companyId,
        residence_customer: residence,
      })
      setState(res)
      if (res.ok) toast.success("Saved")
      else if (res.error) toast.error(res.error)
    })
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="first_name">First name</Label>
          <Input id="first_name" name="first_name" defaultValue={user.firstName ?? ""} disabled={!canEdit} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="last_name">Last name</Label>
          <Input id="last_name" name="last_name" defaultValue={user.lastName ?? ""} disabled={!canEdit} />
        </div>
        <div className="grid gap-2">
          <Label>Email</Label>
          <Input value={user.email ?? ""} disabled readOnly />
        </div>
        <div className="grid gap-2">
          <Label>Role</Label>
          <Select value={roleId} onValueChange={(v) => setRoleId(v ?? String(user.roleTypeId))} disabled={!canEdit}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Company</Label>
          <Select value={companyId} onValueChange={(v) => setCompanyId(v ?? "none")} disabled={!canEdit}>
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Switch checked={residence} onCheckedChange={setResidence} disabled={!canEdit} id="rc" />
          <Label htmlFor="rc">Residence customer</Label>
        </div>
      </div>

      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      {canEdit ? (
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : null}
    </form>
  )
}
