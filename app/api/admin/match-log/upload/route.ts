import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/adminSession";
import { importMatchLogFiles } from "@/lib/matchLog/importMatchLog";
import { decodeMatchLogHtml, MAX_MATCH_LOG_FILE_BYTES } from "@/lib/matchLog/decodeUpload";
import { isRateLimited } from "@/lib/rateLimit";

/**
 * Handler de ruta, no Server Action: los Server Actions de Next tienen un límite de
 * tamaño de cuerpo de 1MB por defecto (sin overridear en next.config.ts), demasiado
 * poco para "subir varios ficheros MatchLog a la vez". Un handler de ruta no tiene
 * ese límite propio de Next (sí el de la plataforma de despliegue, de sobra para esto).
 *
 * `requireAdmin()` no vale aquí: hace `redirect()` de `next/navigation`, pensado para
 * Server Components/Actions, no para un handler de ruta que debe devolver una
 * `Response` — se usa `isAdmin()` directamente y se responde 401 a mano.
 */
export async function POST(request: Request): Promise<Response> {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (await isRateLimited("matchlog_admin", 60 * 60 * 1000, 10)) {
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

  const summary = await importMatchLogFiles(inputs);

  if (summary.totalLinked > 0) {
    revalidatePath("/stats");
  }
  revalidatePath("/account");

  return NextResponse.json({ summary });
}
