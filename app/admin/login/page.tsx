"use client";

import { useActionState } from "react";
import { login } from "../actions";

export default function AdminLoginPage() {
  const [error, formAction, pending] = useActionState(login, null);

  return (
    <div className="mx-auto max-w-sm px-4 py-20">
      <p className="text-eyebrow text-xs text-muted-label">XKT World Tour</p>
      <h1 className="text-headline mb-6 text-2xl text-ink">Admin</h1>
      <form action={formAction} className="space-y-4">
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Password"
          autoFocus
          className="w-full rounded-lg border border-rule bg-paper px-4 py-2.5 text-ink outline-none focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/30"
        />
        {error && <p className="text-sm text-down">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="text-eyebrow w-full rounded-full bg-navy-900 px-6 py-2.5 text-xs text-white transition hover:bg-navy-800 disabled:opacity-50"
        >
          {pending ? "Checking…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
