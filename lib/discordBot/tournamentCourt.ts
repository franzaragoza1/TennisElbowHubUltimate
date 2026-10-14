/**
 * Pista real y escudo de un torneo a partir de su nombre — compartido por el anuncio
 * automático (tasks/announceNewTournament.ts) y el manual (`/new-tournament`).
 * Reportado con capturas, 2026-10-14: anuncios de Basel/Vienna/Firenze sin escudo y
 * con "Surface: Indoor Hard" — el comando manual buscaba el escudo por la superficie
 * escrita (un tipo genérico, sin escudo propio) y el automático enseñaba
 * `editions.surface` (otro tipo genérico). Lo que la comunidad llama "la superficie"
 * de un torneo es la pista del juego ("Basel ATP 500"), y de ahí sale el escudo.
 * Solo para el bot/scraper: usa `fs`, nunca importarlo desde un componente web.
 */
import fs from "node:fs";
import path from "node:path";
import { getCourtNameForTournament } from "@/lib/courtPhysics";
import { getTournamentLogoFolder, slugifyLogoFolder } from "@/lib/tournamentLogos";

export interface TournamentCourt {
  courtName: string | null;
  logoFilePath: string | null;
}

function logoFileFor(folder: string | null): string | null {
  if (!folder) return null;
  const filePath = path.join(process.cwd(), "public", "tournament-logos", `${slugifyLogoFolder(folder)}.png`);
  return fs.existsSync(filePath) ? filePath : null;
}

/** Último recurso para el escudo: un único fichero de `public/tournament-logos/` que
 * empiece por el nombre del torneo ("almaty-atp-250.png" para Almaty, que no está ni
 * en el mapa verificado ni en el CSV de físicas). Varios candidatos: no se adivina. */
function logoFileByPrefix(eventName: string): string | null {
  const prefix = `${slugifyLogoFolder(eventName)}-`;
  if (prefix === "-") return null;
  const dir = path.join(process.cwd(), "public", "tournament-logos");
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".png"));
  } catch {
    return null;
  }
  return files.length === 1 ? path.join(dir, files[0]) : null;
}

export function resolveTournamentCourt(eventName: string): TournamentCourt {
  const verifiedFolder = getTournamentLogoFolder(eventName);
  const courtName = verifiedFolder ?? getCourtNameForTournament(eventName);
  return { courtName, logoFilePath: logoFileFor(verifiedFolder) ?? logoFileFor(courtName) ?? logoFileByPrefix(eventName) };
}
