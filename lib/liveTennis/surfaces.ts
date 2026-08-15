import { readFileSync } from "node:fs";
import path from "node:path";

let cached: Set<string> | null = null;

/**
 * `public/surfaces.txt` — nombres de pista/skin ATP-WTA reales que usan los torneos
 * del tour (mismo vocabulario que `lib/tournamentLogos.ts`/`XKTTBSTD`, ver
 * docs/decisiones.md). live-tennis.cn muestra ese mismo nombre como cabecera de cada
 * partido en vivo — un partido jugado sobre una pista genérica (no de este listado) no
 * es un partido del tour, es señal de otra liga/comunidad usando el mismo motor.
 */
export function loadKnownSurfaces(): Set<string> {
  if (cached) return cached;
  const raw = readFileSync(path.join(process.cwd(), "public", "surfaces.txt"), "utf-8");
  cached = new Set(
    raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== ""),
  );
  return cached;
}
