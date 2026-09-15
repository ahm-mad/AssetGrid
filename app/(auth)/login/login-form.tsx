"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Lock, Mail } from "lucide-react"

import { signIn, type AuthActionState } from "@/lib/auth/actions"

function Field({
  id,
  label,
  type,
  icon: Icon,
  autoComplete,
  toggle,
}: {
  id: string
  label: string
  type: string
  icon: typeof Mail
  autoComplete: string
  toggle?: boolean
}) {
  const [visible, setVisible] = useState(false)
  const resolvedType = toggle ? (visible ? "text" : "password") : type
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block font-mono text-[10px] tracking-[0.16em] text-white/50 uppercase">
        {label}
      </label>
      <div className="focus-within:border-[#2fa1ee] focus-within:shadow-[0_0_0_3px_rgba(47,161,238,0.14),0_0_22px_-6px_rgba(47,161,238,0.55)] flex items-center gap-2.5 rounded-[10px] border border-white/10 bg-black/30 px-3 transition-shadow">
        <Icon className="size-3.5 shrink-0 text-white/40" />
        <input
          id={id}
          name={id}
          type={resolvedType}
          autoComplete={autoComplete}
          required
          className="w-full bg-transparent py-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
          placeholder={type === "email" ? "you@company.com" : "••••••••••••"}
        />
        {toggle ? (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="flex shrink-0 p-1 text-white/40 hover:text-white/70"
            tabIndex={-1}
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function SubmitButton({ label = "Sign in", pendingLabel = "Signing in…" }: { label?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 w-full rounded-[11px] bg-gradient-to-b from-[#4fb2f4] to-[#1683d4] py-3.5 font-mono text-xs font-semibold tracking-[0.2em] text-[#04121e] uppercase shadow-[0_10px_30px_-8px_rgba(47,161,238,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] transition-transform hover:-translate-y-px active:translate-y-0 disabled:opacity-70"
    >
      {pending ? pendingLabel : label}
    </button>
  )
}

function MockLoginForm({ next }: { next?: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  return (
    <form
      className="grid"
      onSubmit={(e) => {
        e.preventDefault()
        setPending(true)
        setTimeout(() => router.push(next ?? "/app"), 500)
      }}
    >
      <Field id="email" label="Operator ID" type="email" icon={Mail} autoComplete="username" />
      <Field id="password" label="Passphrase" type="password" icon={Lock} autoComplete="current-password" toggle />

      <div className="mb-5 flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-white/50">
          <input type="checkbox" className="accent-[#2fa1ee]" defaultChecked />
          Keep me signed in
        </label>
        <span className="font-mono text-[10px] tracking-wide text-white/30 uppercase">Demo mode</span>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-1 w-full rounded-[11px] bg-gradient-to-b from-[#4fb2f4] to-[#1683d4] py-3.5 font-mono text-xs font-semibold tracking-[0.2em] text-[#04121e] uppercase shadow-[0_10px_30px_-8px_rgba(47,161,238,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] transition-transform hover:-translate-y-px active:translate-y-0 disabled:opacity-70"
      >
        {pending ? "Authenticating…" : "Authenticate"}
      </button>
      <p className="mt-5 text-center font-mono text-[9.5px] tracking-[0.12em] text-white/30 uppercase">
        Any credentials work in this build
      </p>
    </form>
  )
}

function RealLoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<AuthActionState, FormData>(signIn, {})

  return (
    <form action={formAction} className="grid">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field id="email" label="Operator ID" type="email" icon={Mail} autoComplete="username" />
      {state.fieldErrors?.email ? <p className="-mt-3 mb-3 text-xs text-[#ff8f8f]">{state.fieldErrors.email[0]}</p> : null}

      <Field id="password" label="Passphrase" type="password" icon={Lock} autoComplete="current-password" toggle />
      {state.fieldErrors?.password ? (
        <p className="-mt-3 mb-3 text-xs text-[#ff8f8f]">{state.fieldErrors.password[0]}</p>
      ) : null}

      <div className="mb-5 flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-white/50">
          <input type="checkbox" className="accent-[#2fa1ee]" defaultChecked />
          Keep me signed in
        </label>
        <a href="#" className="text-xs text-[#2fa1ee] opacity-90 hover:opacity-100">
          Recover access
        </a>
      </div>

      {state.error ? (
        <div className="mb-3 rounded-[9px] border border-[#ff5a5a]/28 bg-[#ff5a5a]/[0.09] px-3 py-2.5 text-center text-[12.5px] text-[#ff8f8f]">
          {state.error}
        </div>
      ) : null}

      <SubmitButton />
      <p className="mt-5 text-center font-mono text-[9.5px] tracking-[0.12em] text-white/30 uppercase">Encrypted session</p>
    </form>
  )
}

export function LoginForm({ next, mock }: { next?: string; mock: boolean }) {
  return mock ? <MockLoginForm next={next} /> : <RealLoginForm next={next} />
}
