import { NextResponse } from "next/server";

/**
 * Sin base de datos, sin auth — a propósito. Su único trabajo es existir para que
 * `.github/workflows/keep-alive.yml` tenga algo barato que pinguear cada 10 minutos y
 * evitar que Render apague el servicio gratuito por inactividad (15 min sin tráfico).
 * Nunca `/` para esto: pasa por `proxy.ts` (el redirect de bienvenida en la primera
 * visita) y cada ping saldría redirigido a /welcome sin necesidad.
 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
