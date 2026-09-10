"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { createCompanyUser, type CreateUserResult } from "@/lib/companies/actions"
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

const KINDS = [
  { value: "admin", label: "Admin (new company)" },
  { value: "manager", label: "Manager (existing company)" },
  { value: "dealer", label: "Dealer (new company)" },
  { value: "partner", label: "Partner (new company)" },
] as const

function F({
  name,
  label,
  errors,
  type = "text",
  required,
}: {
  name: string
  label: string
  errors?: string[]
  type?: string
  required?: boolean
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input id={name} name={name} type={type} />
      {errors?.length ? <p className="text-destructive text-sm">{errors[0]}</p> : null}
    </div>
  )
}

export function CreateUserForm({ companies }: { companies: CompanyOption[] }) {
  const router = useRouter()
  const [pending, start] = React.useTransition()
  const [kind, setKind] = React.useState<(typeof KINDS)[number]["value"]>("admin")
  const [companyId, setCompanyId] = React.useState<string>("")
  const [state, setState] = React.useState<CreateUserResult>({ ok: true })

  const fe = state.fieldErrors ?? {}
  const isManager = kind === "manager"
  const isDealer = kind === "dealer"
  const isPartner = kind === "partner"

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    start(async () => {
      const res = await createCompanyUser({
        kind,
        first_name: fd.get("first_name"),
        last_name: fd.get("last_name"),
        email: fd.get("email"),
        company_name: fd.get("company_name") ?? "",
        company_username: fd.get("company_username") ?? "",
        company_email: fd.get("company_email") ?? "",
        company_id: isManager ? companyId : undefined,
        container_codes: fd.get("container_codes") ?? "",
        inventory_device_ids: fd.get("inventory_device_ids") ?? "",
      })
      setState(res)
      if (res.ok) {
        toast.success(res.inviteSent ? "User created — invite email sent" : "User created")
        router.push(`/app/customers/${res.userId}`)
      } else if (res.error) {
        toast.error(res.error)
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-5">
      <div className="grid gap-2">
        <Label>User type</Label>
        <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <F name="first_name" label="First name" errors={fe.first_name} required />
        <F name="last_name" label="Last name" errors={fe.last_name} required />
        <F name="email" label="Email" type="email" errors={fe.email} required />
      </div>

      {isManager ? (
        <div className="grid gap-2">
          <Label>Company *</Label>
          <Select value={companyId} onValueChange={(v) => setCompanyId(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a company" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fe.company_id?.length ? (
            <p className="text-destructive text-sm">{fe.company_id[0]}</p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 rounded-md border p-4 sm:grid-cols-2">
          <p className="text-muted-foreground col-span-full text-sm">New company</p>
          <F name="company_name" label="Company name" errors={fe.company_name} required />
          <F name="company_username" label="Company username" errors={fe.company_username} required />
          <F name="company_email" label="Company email" type="email" errors={fe.company_email} required />
        </div>
      )}

      {isDealer ? (
        <F
          name="container_codes"
          label="Container codes (comma or space separated)"
          errors={fe.container_codes}
        />
      ) : null}
      {isPartner ? (
        <F
          name="inventory_device_ids"
          label="Inventory device ids (comma or space separated)"
          errors={fe.inventory_device_ids}
        />
      ) : null}

      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create user"}
        </Button>
      </div>
    </form>
  )
}
