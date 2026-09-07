"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePlayerProfile, type UpdatePlayerProfileInput } from "@/app/account/actions";

interface PlayerProfileFormPlayer {
  bio: string | null;
  realName: string | null;
  birthDate: string | null;
  playstyle: string | null;
  clothingBrand: string | null;
  racketBrand: string | null;
  instagramHandle: string | null;
  youtubeUrl: string | null;
}

const inputClass =
  "w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-navy-900";
const labelClass = "text-eyebrow mb-1 block text-xs text-muted-label";

/**
 * Igual patrón que AvatarUpload.tsx: sin `<form action={fn}>` (eso descartaría el
 * `{error}` que devuelve la Server Action) — inputs controlados, `useTransition` +
 * estado de error local, `router.refresh()` al terminar para que la ficha pública
 * (revalidada por la propia acción) se note al momento si el jugador navega allí.
 */
export function PlayerProfileForm({ player }: { player: PlayerProfileFormPlayer }) {
  const [values, setValues] = useState<UpdatePlayerProfileInput>({
    bio: player.bio,
    realName: player.realName,
    birthDate: player.birthDate,
    playstyle: player.playstyle === "right-handed" || player.playstyle === "left-handed" ? player.playstyle : null,
    clothingBrand: player.clothingBrand,
    racketBrand: player.racketBrand,
    instagramHandle: player.instagramHandle,
    youtubeUrl: player.youtubeUrl,
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function set<K extends keyof UpdatePlayerProfileInput>(key: K, raw: string) {
    setSaved(false);
    setValues((v) => ({ ...v, [key]: raw === "" ? null : raw }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const { error } = await updatePlayerProfile(values);
      if (error) {
        setError(error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className={labelClass} htmlFor="bio">
          Bio
        </label>
        <textarea
          id="bio"
          value={values.bio ?? ""}
          onChange={(e) => set("bio", e.target.value)}
          maxLength={500}
          rows={3}
          className={inputClass}
          placeholder="A short intro shown on your tour profile."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="realName">
            Real name (optional)
          </label>
          <input
            id="realName"
            type="text"
            value={values.realName ?? ""}
            onChange={(e) => set("realName", e.target.value)}
            maxLength={80}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="birthDate">
            Birth date
          </label>
          <input
            id="birthDate"
            type="date"
            value={values.birthDate ?? ""}
            onChange={(e) => set("birthDate", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="playstyle">
            Playstyle
          </label>
          <select
            id="playstyle"
            value={values.playstyle ?? ""}
            onChange={(e) => set("playstyle", e.target.value)}
            className={inputClass}
          >
            <option value="">Not set</option>
            <option value="right-handed">Right-handed</option>
            <option value="left-handed">Left-handed</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="clothingBrand">
            Clothing brand
          </label>
          <input
            id="clothingBrand"
            type="text"
            value={values.clothingBrand ?? ""}
            onChange={(e) => set("clothingBrand", e.target.value)}
            maxLength={60}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="racketBrand">
            Racket brand
          </label>
          <input
            id="racketBrand"
            type="text"
            value={values.racketBrand ?? ""}
            onChange={(e) => set("racketBrand", e.target.value)}
            maxLength={60}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="instagramHandle">
            Instagram handle
          </label>
          <input
            id="instagramHandle"
            type="text"
            value={values.instagramHandle ?? ""}
            onChange={(e) => set("instagramHandle", e.target.value)}
            maxLength={60}
            placeholder="without the @"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="youtubeUrl">
            YouTube URL
          </label>
          <input
            id="youtubeUrl"
            type="url"
            value={values.youtubeUrl ?? ""}
            onChange={(e) => set("youtubeUrl", e.target.value)}
            maxLength={300}
            placeholder="https://youtube.com/@..."
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="text-eyebrow rounded-full bg-navy-900 px-6 py-2.5 text-xs text-white transition hover:bg-navy-800 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save profile"}
        </button>
        {error && <p className="text-down text-xs">{error}</p>}
        {!error && saved && <p className="text-up text-xs">Saved.</p>}
      </div>
    </form>
  );
}
