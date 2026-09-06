import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { importMatchLogFiles } from "@/lib/matchLog/importMatchLog";
import { decodeMatchLogHtml, MAX_MATCH_LOG_FILE_BYTES } from "@/lib/matchLog/decodeUpload";
import { isRateLimited } from "@/lib/rateLimit";

/**
 * Versión para cualquier usuario con sesión (no solo admin) de
 * app/api/admin/match-log/upload/route.ts — mismo motivo para ser un handler de ruta
 * y no un Server Action (límite de 1MB de los Server Actions). `uploadedByUserId` es lo
 * único que cambia de verdad: permite que app/api/account/match-log/reminder/route.ts
 * sepa cuándo subió ESTE usuario su último fichero.
 */
export async function POST(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (await isRateLimited(`matchlog:${user.id}`, 60 * 60 * 1000, 10)) {
    return NextResponse.json({ error: "too many uploads — try again later" }, { status: 429 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "no files uploaded" }, { status: 400 });
  }
  const oversized = files.find((f) => f.size > MAX_MATCH_LOG_FILE_BYTES);
  if (oversized) {
    return NextResponse.json({ error: `"${oversized.name}" is too large — MatchLog files should be a few MB at most` }, { status: 413 });
  }

  // Ver lib/matchLog/decodeUpload.ts: el <meta charset> del propio fichero dice
  // iso-8859-1, pero un nombre no-ASCII de verdad viene en UTF-8 — se sniffa en vez de
  // fiarse de la etiqueta declarada.
  const inputs = await Promise.all(
    files.map(async (file) => ({
      fileName: file.name,
      html: decodeMatchLogHtml(await file.arrayBuffer()),
    })),
  );

  const summary = await importMatchLogFiles(inputs, user.id);

  if (summary.totalLinked > 0) {
    revalidatePath("/stats");
  }
  revalidatePath("/account");

  return NextResponse.json({ summary });
}
