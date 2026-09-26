import * as cheerio from "cheerio";
import { z } from "zod";

/**
 * `OT_Player.php?p=<id>&d=0` — ficha del jugador en Mana Games. Solo se lee lo que
 * necesitamos de ella: el país. Es el MISMO campo de texto libre que ya sale en la
 * tabla del ranking, pero sin el desfase: el ranking no lo trae para jugadores que nunca
 * han estado en él, y lo entrega roto ("ÎÎÎÎÎÎ") cuando el texto no es latino, mientras
 * que la ficha lo da bien ("ΕΛΛΑΔΑ") — ver docs/estructura.md §"Ficha de jugador".
 */
export const PlayerProfileSchema = z.object({
  externalId: z.string().regex(/^\d+$/),
  displayName: z.string().min(1),
  /** Texto libre tal cual lo escribió el jugador; null si el campo está vacío (mucha
   * gente nunca lo rellena — no es un fallo del parser). */
  country: z.string().nullable(),
  /** "Availability Schedule" — texto libre (días, horas y zona horaria, tal cual lo
   * escribió el jugador: "Week Days: from 17:00 to 00.00 UTC-4"). null si está vacío. */
  availability: z.string().nullable(),
});
export type ParsedPlayerProfile = z.infer<typeof PlayerProfileSchema>;

export function parsePlayerProfilePage(html: string): ParsedPlayerProfile {
  const $ = cheerio.load(html);

  // Falla en voz alta si la plantilla cambia — nunca se escribe un país "degradado".
  const heading = $("h2").filter((_, el) => /^\s*Player Details:/i.test($(el).text())).first();
  if (heading.length === 0) throw new Error("Not a player profile page: no 'Player Details' heading");

  const link = heading.find("a").first();
  const externalId = new URL(link.attr("href") ?? "", "https://example.invalid/").searchParams.get("u");
  const displayName = link.text().trim();

  const countryDt = $("dt")
    .filter((_, el) => /^\s*Country\s*:/i.test($(el).text()))
    .first();
  if (countryDt.length === 0) throw new Error("Player profile has no 'Country' field");
  const country = countryDt.text().replace(/^\s*Country\s*:/i, "").trim() || null;

  // No es obligatorio como el país: si la plantilla lo quita, solo se pierde este dato.
  const availabilityDt = $("dt")
    .filter((_, el) => /^\s*Availability Schedule\s*:/i.test($(el).text()))
    .first();
  const availability = availabilityDt.next("dd").text().replace(/\s+/g, " ").trim() || null;

  return PlayerProfileSchema.parse({ externalId, displayName, country, availability });
}
