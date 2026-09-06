"use client";

import { signIn } from "next-auth/react";

/** `callbackUrl` opcional — dónde volver después del OAuth de Discord. Sin él, cae al
 * comportamiento de siempre (la propia página). Lo usa app/welcome/page.tsx para
 * devolver a alguien a la página que pedía de verdad antes de que `proxy.ts` lo
 * mandara aquí en su primera visita. */
export function SignInButton({ callbackUrl }: { callbackUrl?: string } = {}) {
  return (
    <button
      type="button"
      onClick={() => signIn("discord", callbackUrl ? { callbackUrl } : undefined)}
      className="text-eyebrow rounded-full bg-navy-900 px-6 py-2.5 text-xs text-white hover:bg-navy-800"
    >
      Sign in with Discord
    </button>
  );
}
