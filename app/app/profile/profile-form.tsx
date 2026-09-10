"use client"

import { useActionState, useEffect } from "react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"

import { updateMyProfile, type ProfileActionState } from "@/lib/profile/actions"
import type { MyProfile } from "@/lib/profile/data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function Field({
  name,
  label,
  defaultValue,
  errors,
  type = "text",
}: {
  name: string
  label: string
  defaultValue?: string | null
  errors?: string[]
  type?: string
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} />
      {errors?.length ? <p className="text-destructive text-sm">{errors[0]}</p> : null}
    </div>
  )
}

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  )
}

export function ProfileForm({ profile }: { profile: MyProfile }) {
  const [state, formAction] = useActionState<ProfileActionState, FormData>(updateMyProfile, {})

  useEffect(() => {
    if (state.ok) toast.success("Profile updated")
    else if (state.error) toast.error(state.error)
  }, [state])

  const d = profile.details

  return (
    <form action={formAction} className="grid max-w-2xl gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="first_name" label="First name" defaultValue={profile.firstName} errors={state.fieldErrors?.first_name} />
        <Field name="last_name" label="Last name" defaultValue={profile.lastName} errors={state.fieldErrors?.last_name} />
        <div className="grid gap-2">
          <Label>Email</Label>
          <Input value={profile.email ?? ""} disabled readOnly />
        </div>
        <Field name="phone_number" label="Phone" defaultValue={d?.phoneNumber} errors={state.fieldErrors?.phone_number} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="address_1" label="Address line 1" defaultValue={d?.address1} />
        <Field name="address_2" label="Address line 2" defaultValue={d?.address2} />
        <Field name="city" label="City" defaultValue={d?.city} />
        <Field name="state" label="State / province" defaultValue={d?.state} />
        <Field name="postal_code" label="Postal code" defaultValue={d?.postalCode} />
        <Field name="country" label="Country" defaultValue={d?.country} />
      </div>

      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      <div>
        <SaveButton />
      </div>
    </form>
  )
}
