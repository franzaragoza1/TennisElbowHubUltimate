import { NextRequest, NextResponse } from "next/server";
import { syncChannelVideos } from "@/lib/youtube/sync";

/**
 * Disparado por Vercel Cron (ver `vercel.json`) o a mano con curl para probar. Cierra
 * en falso si `CRON_SECRET` no está configurada — mejor un endpoint inactivo que uno
 * de escritura abierto sin autenticar.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 501 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncChannelVideos();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sync failed" }, { status: 500 });
  }
}
