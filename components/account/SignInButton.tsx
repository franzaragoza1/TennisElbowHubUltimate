"use client";

import { signIn } from "next-auth/react";

/** `callbackUrl` opcional — dónde volver después del OAuth de Discord. Sin él, cae a
 * `/account` (pedido explícito: iniciar sesión siempre debe llevar ahí, no dejar a
 * quien entra en la página en la que ya estaba) — nunca "la propia página" como antes.
 * app/welcome/page.tsx sigue pasando el suyo explícito para devolver a alguien a la
 * página que pedía de verdad antes de que `proxy.ts` lo mandara aquí en su primera
 * visita. */
export function SignInButton({ callbackUrl = "/account" }: { callbackUrl?: string } = {}) {
  return (
    <button
      type="button"
      onClick={() => signIn("discord", { callbackUrl })}
      className="text-eyebrow rounded-full bg-navy-900 px-6 py-2.5 text-xs text-white hover:bg-navy-800"
    >
      Sign in with Discord
    </button>
  );
}
