"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  // `refetchOnWindowFocus` por defecto es `true` en next-auth — revalida la sesión
  // contra la base de datos (session: { strategy: "database" }) cada vez que alguien
  // vuelve a una pestaña, para CUALQUIER página, sin relación con lo que el propio
  // Server Component ya resolvió al renderizar. Pase de rendimiento (2026-09-13):
  // confirmado como la fuente de más volumen de peticiones de sesión del sitio entero.
  return <SessionProvider refetchOnWindowFocus={false}>{children}</SessionProvider>;
}
