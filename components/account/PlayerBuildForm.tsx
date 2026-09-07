"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePlayerBuild, setBuildInUse, updatePlayerBuild, type UpdatePlayerBuildInput } from "@/app/account/actions";
import { ACCELERATION_TRAITS, ALL_STAT_KEYS, ARCHETYPES, MAX_BUILD_NAME_LENGTH, STAT_SECTIONS, type StatKey } from "@/lib/buildStats";
import { computeBuildPoints, VALID_REMAINING_POINTS } from "@/lib/buildPoints";

interface PlayerBuildFormBuild extends Omit<UpdatePlayerBuildInput, "isPublic"> {
  isPublic: boolean;
}

const inputClass =
  "w-full rounded-md border border-rule bg-paper px-2 py-1.5 text-sm text-ink outline-none focus-visible:border-navy-900";
const labelClass = "text-eyebrow mb-1 block text-[10px] text-muted-label";

/** El "bar" del juego, pero interactivo — se puede arrastrar Y teclear el número
 * directamente, pedido explícito ("make every stat also an interactive progression
 * bar like in the screenshot but that can also be typed"). Las dos entradas
 * comparten el mismo valor: arrastrar actualiza la casilla, teclear actualiza la
 * barra. La casilla "Public" al lado es el toggle de visibilidad de ESTE stat en
 * concreto (`visibleStats`), independiente del resto. */
function StatField({
  label,
  value,
  onChange,
  isVisible,
  onToggleVisible,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  isVisible: boolean;
  onToggleVisible: (visible: boolean) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="text-eyebrow text-[10px] text-muted-label">{label}</label>
        <label className="text-muted-label flex shrink-0 items-center gap-1 text-[10px]">
          <input type="checkbox" checked={isVisible} onChange={(e) => onToggleVisible(e.target.checked)} className="h-3 w-3" />
          Public
        </label>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          value={value ?? 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 flex-1 accent-blue-500"
        />
        <input
          type="number"
          min={0}
          max={100}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="w-14 shrink-0 rounded-md border border-rule bg-paper px-1.5 py-1 text-xs text-ink outline-none focus-visible:border-navy-900"
        />
      </div>
    </div>
  );
}

/**
 * Ficha de "Build" del juego — igual patrón que PlayerProfileForm.tsx (inputs
 * controlados, `useTransition` + error/saved locales, llama a la Server Action
 * directamente). No hay forma de importar esto del foro (dato local de
 * partida-única), así que el jugador lo rellena a mano (o lo lee la IA del
 * screenshot, ver BuildImageUpload.tsx, y esto solo revisa/corrige).
 *
 * "Points" no es una casilla más — se calcula en vivo con la misma fórmula que usa
 * el servidor para validar (lib/buildPoints.ts), así el jugador ve al momento si su
 * build ya gasta el presupuesto real del juego, sin esperar a guardar para
 * enterarse.
 */
export function PlayerBuildForm({
  buildId,
  build,
  isInUse,
}: {
  buildId: number;
  build: PlayerBuildFormBuild;
  isInUse: boolean;
}) {
  const [values, setValues] = useState<UpdatePlayerBuildInput>(build);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isSettingInUse, startSettingInUse] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const router = useRouter();

  const points = computeBuildPoints(values);
  const isValidToPost = points === VALID_REMAINING_POINTS;

  function set<K extends keyof UpdatePlayerBuildInput>(key: K, value: UpdatePlayerBuildInput[K]) {
    setSaved(false);
    setError(null);
    setValues((v) => ({ ...v, [key]: value }));
  }

  function toggleStatVisible(key: StatKey, visible: boolean) {
    setSaved(false);
    setError(null);
    setValues((v) => ({
      ...v,
      visibleStats: visible ? [...v.visibleStats, key] : v.visibleStats.filter((k) => k !== key),
    }));
  }

  function setAllStatsVisible(visible: boolean) {
    setSaved(false);
    setError(null);
    setValues((v) => ({ ...v, visibleStats: visible ? [...ALL_STAT_KEYS] : [] }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const { error } = await updatePlayerBuild(buildId, values);
      if (error) {
        setError(error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  function handleSetInUse() {
    setError(null);
    startSettingInUse(async () => {
      const { error } = await setBuildInUse(buildId);
      if (error) setError(error);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${values.name || "this build"}"? This can't be undone.`)) return;
    setError(null);
    startDeleting(async () => {
      const { error } = await deletePlayerBuild(buildId);
      if (error) {
        setError(error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label className={labelClass} htmlFor="build-name">
            Build name
          </label>
          <input
            id="build-name"
            type="text"
            value={values.name}
            maxLength={MAX_BUILD_NAME_LENGTH}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Clay grinder"
            className={inputClass}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isInUse ? (
            <span className="text-eyebrow rounded-full bg-up/10 px-3 py-1.5 text-[11px] text-up">In use</span>
          ) : (
            <button
              type="button"
              onClick={handleSetInUse}
              disabled={isSettingInUse}
              className="text-eyebrow rounded-full border border-rule px-3 py-1.5 text-[11px] text-ink transition-colors hover:border-blue-500 hover:text-blue-500 disabled:opacity-50"
            >
              {isSettingInUse ? "Setting…" : "Set as in-use"}
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-eyebrow rounded-full border border-rule px-3 py-1.5 text-[11px] text-down transition-colors hover:border-down disabled:opacity-50"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border border-rule bg-paper-tint px-3 py-2">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-eyebrow text-muted-label">Points remaining</span>
          <span className={`tour-numeric text-sm font-medium ${isValidToPost ? "text-up" : "text-ink"}`}>
            {points} / {VALID_REMAINING_POINTS}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setAllStatsVisible(true)} className="text-eyebrow text-[10px] text-blue-500 hover:underline">
            Show all
          </button>
          <button
            type="button"
            onClick={() => setAllStatsVisible(false)}
            className="text-eyebrow text-muted-label text-[10px] hover:underline"
          >
            Hide all
          </button>
        </div>
      </div>

      {STAT_SECTIONS.map((section) => (
        <fieldset key={section.title}>
          <legend className="text-eyebrow mb-2 text-xs text-muted-label">{section.title}</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {section.fields.map((f) => (
              <StatField
                key={f.key}
                label={f.label}
                value={values[f.key]}
                onChange={(v) => set(f.key, v)}
                isVisible={values.visibleStats.includes(f.key)}
                onToggleVisible={(visible) => toggleStatVisible(f.key, visible)}
              />
            ))}
          </div>
        </fieldset>
      ))}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="build-archetype">
            Archetype
          </label>
          <select
            id="build-archetype"
            value={values.archetype ?? ""}
            onChange={(e) => set("archetype", e.target.value === "" ? null : (e.target.value as UpdatePlayerBuildInput["archetype"]))}
            className={inputClass}
          >
            <option value="">Not set</option>
            {ARCHETYPES.map((archetype) => (
              <option key={archetype} value={archetype}>
                {archetype}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="build-acceleration">
            Acceleration trait
          </label>
          <select
            id="build-acceleration"
            value={values.accelerationTrait ?? ""}
            onChange={(e) => set("accelerationTrait", e.target.value === "" ? null : (e.target.value as UpdatePlayerBuildInput["accelerationTrait"]))}
            className={inputClass}
          >
            <option value="">Not set</option>
            {ACCELERATION_TRAITS.map((trait) => (
              <option key={trait} value={trait}>
                {trait}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={`flex items-center gap-2 text-sm ${isValidToPost ? "text-ink" : "text-muted-label"}`}>
          <input
            type="checkbox"
            checked={values.isPublic}
            disabled={!isValidToPost}
            onChange={(e) => set("isPublic", e.target.checked)}
            className="h-4 w-4"
          />
          Show my Build on my public profile
        </label>
        {!isValidToPost && (
          <p className="text-muted-label mt-1 text-xs">
            Your build needs to spend exactly your point budget ({VALID_REMAINING_POINTS} remaining) before it can go public —
            you&rsquo;re currently at {points}.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="text-eyebrow rounded-full bg-navy-900 px-6 py-2.5 text-xs text-white transition hover:bg-navy-800 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save build"}
        </button>
        {error && <p className="text-down text-xs">{error}</p>}
        {!error && saved && <p className="text-up text-xs">Saved.</p>}
      </div>
    </form>
  );
}
