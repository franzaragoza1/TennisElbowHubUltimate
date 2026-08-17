"use client";

import { updateCountryOverride } from "@/app/admin/players/actions";

export function CountryOverrideForm({
  playerId,
  realCountry,
  countryOverride,
}: {
  playerId: number;
  realCountry: string | null;
  countryOverride: string | null;
}) {
  return (
    <form action={updateCountryOverride} className="rounded-lg border border-rule bg-paper p-4">
      <input type="hidden" name="playerId" value={playerId} />
      <p className="text-eyebrow mb-1 text-xs text-muted-label">As scraped from Mana Games</p>
      <p className="text-ink mb-3 text-sm">{realCountry ?? "—"}</p>

      <label htmlFor="countryOverride" className="text-eyebrow mb-1 block text-xs text-muted-label">
        Displayed nationality (leave empty to use the real one)
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="countryOverride"
          type="text"
          name="countryOverride"
          defaultValue={countryOverride ?? ""}
          placeholder={realCountry ?? "e.g. Italy"}
          className="w-56 rounded border border-rule px-2 py-1 text-sm text-ink"
        />
        <button type="submit" className="text-eyebrow rounded-full bg-navy-900 px-4 py-1.5 text-xs text-white hover:bg-navy-800">
          Save
        </button>
      </div>
    </form>
  );
}
