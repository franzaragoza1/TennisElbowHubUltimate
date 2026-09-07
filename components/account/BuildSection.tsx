"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPlayerBuild, type UpdatePlayerBuildInput } from "@/app/account/actions";
import { MAX_BUILDS_PER_PLAYER, MAX_BUILD_NAME_LENGTH } from "@/lib/buildStats";
import { BuildImageUpload } from "./BuildImageUpload";
import { PlayerBuildForm } from "./PlayerBuildForm";

export interface BuildListEntry extends UpdatePlayerBuildInput {
  id: number;
  inUse: boolean;
  characterImageUrl: string | null;
}

const tabClass = (active: boolean) =>
  `text-eyebrow flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] transition-colors ${
    active ? "border-navy-900 bg-navy-900 text-white" : "border-rule text-ink hover:border-blue-500 hover:text-blue-500"
  }`;

/**
 * Coordina hasta MAX_BUILDS_PER_PLAYER builds por jugador (pedido explícito: "create
 * a maximum of 3 uploaded builds, call them whatever they want and set only a 'In
 * use' build") — antes era una sola build 1:1 con el jugador. Recibe la lista
 * COMPLETA ya cargada del servidor (a lo sumo 3 filas, barato traerlas enteras de
 * golpe en vez de pedir cada una por separado al cambiar de pestaña).
 *
 * `selectedId` puede quedar apuntando a una build que ya no existe (se acaba de
 * borrar) — en vez de sincronizarlo aparte con un efecto, `selected` se deriva cada
 * render con un fallback en cascada (la seleccionada → la "in use" → la primera →
 * ninguna), así que un `router.refresh()` tras borrar ya lo resuelve solo.
 */
export function BuildSection({ builds }: { builds: BuildListEntry[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(builds.find((b) => b.inUse)?.id ?? builds[0]?.id ?? null);
  const [extracted, setExtracted] = useState<Partial<UpdatePlayerBuildInput> | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, startCreating] = useTransition();
  const router = useRouter();

  const selected = builds.find((b) => b.id === selectedId) ?? builds.find((b) => b.inUse) ?? builds[0] ?? null;

  function selectBuild(id: number) {
    setSelectedId(id);
    setExtracted(null);
  }

  function handleCreate() {
    setCreateError(null);
    startCreating(async () => {
      const { buildId, error } = await createPlayerBuild(newName);
      if (error) {
        setCreateError(error);
        return;
      }
      setNewName("");
      setShowNewForm(false);
      if (buildId) setSelectedId(buildId);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {builds.map((b) => (
          <button key={b.id} type="button" onClick={() => selectBuild(b.id)} className={tabClass(b.id === selected?.id)}>
            {b.inUse && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-up" aria-hidden="true" />}
            {b.name}
          </button>
        ))}
        {builds.length < MAX_BUILDS_PER_PLAYER &&
          (showNewForm ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={MAX_BUILD_NAME_LENGTH}
                placeholder="Build name"
                autoFocus
                className="w-36 rounded-full border border-rule bg-paper px-3 py-1.5 text-xs text-ink outline-none focus-visible:border-navy-900"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={isCreating}
                className="text-eyebrow rounded-full bg-navy-900 px-3 py-1.5 text-[11px] text-white disabled:opacity-50"
              >
                {isCreating ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewForm(false);
                  setCreateError(null);
                }}
                className="text-eyebrow text-[11px] text-muted-label hover:text-ink"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNewForm(true)}
              className="text-eyebrow shrink-0 rounded-full border border-dashed border-rule px-3 py-1.5 text-[11px] text-blue-500 hover:border-blue-500"
            >
              + New build
            </button>
          ))}
      </div>
      {createError && <p className="text-down mb-4 text-xs">{createError}</p>}

      {selected ? (
        <>
          <BuildImageUpload key={`${selected.id}-image`} buildId={selected.id} currentImageUrl={selected.characterImageUrl} onExtracted={setExtracted} />
          <div className="mt-6">
            <PlayerBuildForm
              key={`${selected.id}-${extracted ? "extracted" : "initial"}`}
              buildId={selected.id}
              isInUse={selected.inUse}
              build={extracted ? { ...selected, ...extracted } : selected}
            />
          </div>
        </>
      ) : (
        <p className="text-muted-label rounded-lg border border-rule bg-paper-tint px-4 py-8 text-center text-sm">
          You don&apos;t have a Build yet — create one above to get started.
        </p>
      )}
    </div>
  );
}
