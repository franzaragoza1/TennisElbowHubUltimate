"use client";

import { useState } from "react";
import { STAT_SECTIONS, isBuildRenderable, type StatKey, type PlayerBuildCardData } from "@/lib/buildStats";

export type { PlayerBuildCardData };

/** Copia el código al portapapeles — es texto opaco pensado para pegarse tal cual en
 * el juego, así que un botón de copiar de verdad importa más aquí que en cualquier
 * otro campo de la ficha. */
function OutfitCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Portapapeles bloqueado (permiso denegado, contexto no seguro...) — el código
      // sigue ahí, seleccionable a mano, así que no hace falta ni un error visible.
    }
  }

  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-eyebrow text-[10px] text-muted-label">Outfit code</p>
        <button type="button" onClick={handleCopy} className="text-eyebrow text-[10px] text-blue-500 hover:underline">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="max-h-32 overflow-auto rounded-md border border-rule bg-paper-tint p-2 font-mono text-xs whitespace-pre-wrap text-ink">
        {code}
      </pre>
    </div>
  );
}

function StatBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-xs">
        <span className="text-muted-label">{label}</span>
        <span className="tour-numeric text-ink">{value}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-rule">
        <div className="h-full rounded-full bg-blue-500" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

/** Una build pública — pedido explícito: la ficha pública enseña TODAS las builds
 * públicas del jugador, no solo la "in use" (antes solo se traía esa desde
 * app/players/[id]/page.tsx). El nombre de la build y el badge "In use" distinguen
 * cada una cuando el jugador guarda más de una (hasta MAX_BUILDS_PER_PLAYER,
 * lib/buildStats.ts). */
function SingleBuildCard({ build }: { build: PlayerBuildCardData }) {
  const isStatShown = (key: StatKey) => build[key] !== null && build.visibleStats.includes(key);
  const hasAnyStat = STAT_SECTIONS.some((s) => s.fields.some((f) => isStatShown(f.key)));
  const hasFacts = build.archetype || build.accelerationTrait || build.points !== null;

  return (
    <div className="mb-6 rounded-lg border border-rule bg-paper p-4 shadow-sm last:mb-0">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-headline text-sm text-ink">{build.name}</h3>
        {build.inUse && <span className="text-eyebrow rounded-full bg-up/10 px-2 py-0.5 text-[10px] text-up">In use</span>}
      </div>
      <div className="flex flex-col gap-4 sm:flex-row">
        {build.characterImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- recorte guardado como data URI, no un asset next/image
          <img
            src={build.characterImageUrl}
            alt="In-game character"
            className="max-h-64 w-auto max-w-[12rem] shrink-0 self-center rounded-lg border border-rule object-contain sm:self-start"
          />
        )}
        <div className="min-w-0 flex-1">
          {hasFacts && (
            <div className="mb-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink">
              {build.archetype && (
                <div>
                  <p className="text-eyebrow text-[10px] text-muted-label">Archetype</p>
                  <p>{build.archetype}</p>
                </div>
              )}
              {build.accelerationTrait && (
                <div>
                  <p className="text-eyebrow text-[10px] text-muted-label">Acceleration</p>
                  <p className="text-muted-label">{build.accelerationTrait}</p>
                </div>
              )}
              {build.points !== null && (
                <div>
                  <p className="text-eyebrow text-[10px] text-muted-label">Points</p>
                  <p className="tour-numeric">{build.points} pts</p>
                </div>
              )}
            </div>
          )}
          {build.outfitCode && <OutfitCodeBlock code={build.outfitCode} />}
          {hasAnyStat && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {STAT_SECTIONS.map((section) => {
                const visibleFields = section.fields.filter((f) => isStatShown(f.key));
                if (visibleFields.length === 0) return null;
                return (
                  <div key={section.title}>
                    <p className="text-eyebrow mb-1.5 text-[10px] text-muted-label">{section.title}</p>
                    <div className="flex flex-col gap-1.5">
                      {visibleFields.map((f) => (
                        <StatBar key={f.key} label={f.label} value={build[f.key]} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Fichas de "Build" del juego — una por cada build que el jugador guardó Y marcó
 * pública (`isPublic`, apagado por defecto en components/account/PlayerBuildForm.tsx),
 * no solo la que tiene marcada como "in use". Cada stat, además, solo se enseña si
 * está en `visibleStats` — el jugador decide caso por caso qué stats concretos se ven,
 * no es todo o nada dentro de un build público (pedido explícito, "add a trigger for
 * every stat to specifically keep it private or public"). No es un dato importado del
 * foro: lo rellena el propio jugador a mano, así que se presenta tal cual, sin
 * pretender que sea un dato verificado.
 */
export function PlayerBuildCard({ builds }: { builds: PlayerBuildCardData[] }) {
  const visibleBuilds = builds.filter((b) => b.isPublic && isBuildRenderable(b));
  if (visibleBuilds.length === 0) return null;

  return (
    <>
      <h2 className="text-headline mb-4 text-lg text-ink">Build{visibleBuilds.length > 1 ? "s" : ""}</h2>
      <div className="mb-8">
        {visibleBuilds.map((build) => (
          <SingleBuildCard key={build.id} build={build} />
        ))}
      </div>
    </>
  );
}
