"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { editions, events } from "@/db/schema";
import { requireAdmin } from "@/lib/adminSession";
import { ensureNativeSource } from "@/lib/nativeTournaments/source";
import { normalizeEventName } from "@/lib/mana/loaders";
import { getIsoWeek } from "@/lib/isoWeek";

const VALID_CATEGORIES = new Set([
  "Grand Slam",
  "Masters 1000",
  "500",
  "250",
  "CT 125",
  "CT 110",
  "CT 100",
  "CT 90",
  "CT 80",
  "CT 75",
  "Future",
]);
const VALID_SURFACES = new Set(["Hard", "Clay", "Grass", "Indoor"]);

// >= 8, no solo potencia de 2: lib/bracket.ts::fullRoundLadder da una escalera
// incorrecta (3 rondas Q/S/F) para un cuadro de 2 o 4 — nunca se ha visto un
// tamaño así en datos reales (docs/estructura.md: el mínimo observado es 8), así
// que esa función nunca se pensó ni se probó por debajo de 8. Evitarlo aquí es más
// simple que arreglar una función compartida con todo el resto del cuadro.
function isValidDrawSize(n: number): boolean {
  return n >= 8 && (n & (n - 1)) === 0;
}

/**
 * Crea el `events`/`editions` de un torneo NATIVO (sourceId = te4tour, ver
 * lib/nativeTournaments/source.ts) — nada se scrapea, todo lo pone el admin.
 * `externalId` es un identificador sintético propio (nunca hubo un `Trn=` que
 * copiar) generado de antemano, para no necesitar un segundo UPDATE tras el INSERT
 * solo para rellenar la clave única `unique(sourceId, externalId)`. Sin partidos,
 * byes ni huecos pendientes todavía: `deriveTournamentStatus`
 * (lib/tournamentStatus.ts) ya la enseña como "Registration Open" sin necesitar una
 * columna de estado aparte — es el mismo criterio que un torneo scrapeado.
 */
export async function createNativeTournament(formData: FormData): Promise<void> {
  await requireAdmin();

  const eventName = String(formData.get("eventName") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const surface = String(formData.get("surface") ?? "");
  const dateRaw = String(formData.get("date") ?? "");
  const drawSize = Number(formData.get("drawSize"));

  if (!eventName || !VALID_CATEGORIES.has(category) || !VALID_SURFACES.has(surface)) {
    redirect("/admin/native-tournaments?error=invalid-fields");
  }
  if (!isValidDrawSize(drawSize)) redirect("/admin/native-tournaments?error=invalid-draw-size");
  const date = new Date(`${dateRaw}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) redirect("/admin/native-tournaments?error=invalid-date");

  const sourceId = await ensureNativeSource();
  const normalizedName = normalizeEventName(eventName);

  const [existingEvent] = await db.select().from(events).where(and(eq(events.sourceId, sourceId), eq(events.normalizedName, normalizedName)));
  const eventId = existingEvent
    ? existingEvent.id
    : (await db.insert(events).values({ sourceId, normalizedName, displayName: eventName }).returning({ id: events.id }))[0].id;

  const { isoYear, isoWeek } = getIsoWeek(date);
  const externalId = `native-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const [edition] = await db
    .insert(editions)
    .values({
      eventId,
      sourceId,
      externalId,
      year: isoYear,
      isoWeek,
      weekStartDate: dateRaw,
      surface,
      category,
      competition: "Singles",
      drawSize,
    })
    .returning({ id: editions.id });

  revalidatePath("/admin/native-tournaments");
  redirect(`/admin/native-tournaments/${edition.id}`);
}
