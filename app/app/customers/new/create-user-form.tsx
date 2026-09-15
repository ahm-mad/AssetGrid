"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { UserCog, Building2, Store, Handshake, type LucideIcon } from "lucide-react"

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
import { cn } from "cn"

const KINDS: { value: "admin" | "manager" | "dealer" | "partner"; label: string; hint: string; icon: LucideIcon }[] = [
  { value: "admin", label: "Admin", hint: "New company", icon: UserCog },
  { value: "manager", label: "Manager", hint: "Existing company", icon: Building2 },
  { value: "dealer", label: "Dealer", hint: "New company", icon: Store },
  { value: "partner", label: "Partner", hint: "New company", icon: Handshake },
]

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

export function CreateUserForm({ companies, mock = false }: { companies: CompanyOption[]; mock?: boolean }) {
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
    setState({ ok: true })

    if (mock) {
      const firstName = String(fd.get("first_name") ?? "").trim()
      const lastName = String(fd.get("last_name") ?? "").trim()
      const email = String(fd.get("email") ?? "").trim()
      const fieldErrors: Record<string, string[]> = {}
      if (!firstName) fieldErrors.first_name = ["Required"]
      if (!lastName) fieldErrors.last_name = ["Required"]
      if (!email) fieldErrors.email = ["Required"]
      if (isManager && !companyId) fieldErrors.company_id = ["Pick a company"]
      if (!isManager && !String(fd.get("company_name") ?? "").trim()) {
        fieldErrors.company_name = ["Required"]
      }
      if (Object.keys(fieldErrors).length) {
        setState({ ok: false, fieldErrors })
        toast.error("Check the fields")
        return
      }
      start(async () => {
        await new Promise((r) => setTimeout(r, 500))
        toast.success(`${firstName} ${lastName} created — invite email sent`)
        router.push("/app/customers")
      })
      return
    }

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
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-6">
      <div className="grid gap-2">
        <p className="eyebrow">Account type</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {KINDS.map((k) => {
            const Icon = k.icon
            const active = kind === k.value
            return (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-md border p-3 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/5"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", active ? "text-primary" : "opacity-70")} />
                <span>
                  <span className={cn("block text-sm", active ? "text-foreground font-semibold" : "font-medium")}>
                    {k.label}
                  </span>
                  <span className="eyebrow !text-[10px]">{k.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-3 rounded-md border p-4">
        <p className="eyebrow">Identity</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <F name="first_name" label="First name" errors={fe.first_name} required />
          <F name="last_name" label="Last name" errors={fe.last_name} required />
          <div className="sm:col-span-2">
            <F name="email" label="Email" type="email" errors={fe.email} required />
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-md border p-4">
        <p className="eyebrow">Company</p>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <p className="text-muted-foreground col-span-full text-xs">
              A new company is created for this {kind}.
            </p>
            <F name="company_name" label="Company name" errors={fe.company_name} required />
            <F name="company_username" label="Company username" errors={fe.company_username} required />
            <div className="sm:col-span-2">
              <F name="company_email" label="Company email" type="email" errors={fe.company_email} required />
            </div>
          </div>
        )}
      </div>

      {isDealer || isPartner ? (
        <div className="grid gap-3 rounded-md border p-4">
          <p className="eyebrow">Additional details</p>
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
        </div>
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
