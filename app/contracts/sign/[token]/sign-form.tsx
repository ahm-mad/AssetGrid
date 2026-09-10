"use client";

import * as React from "react";

import { submitSignToken } from "@/lib/marina/pms/contract-actions";

export function SignForm({ token, kind }: { token: string; kind: "contract" | "amendment" }) {
  const [pending, start] = React.useTransition();
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (done) {
    return (
      <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-900">
        Signed. Thank you — you can close this page.
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await submitSignToken(token);
            if (res.ok) setDone(true);
            else setError(res.error ?? "Could not sign. The link may have expired.");
          })
        }
      >
        {pending ? "Signing…" : `I agree and sign this ${kind}`}
      </button>
      <p className="text-xs text-neutral-500">
        Signing records your agreement, the time, and your IP address.
      </p>
    </div>
  );
}
