import Link from "next/link";
import { searchPlayers } from "@/app/admin/players/actions";

export const dynamic = "force-dynamic";

export default async function AdminPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const rows = await searchPlayers(q?.trim() ?? "");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-headline text-2xl text-ink">Players</h1>
        <p className="text-muted-label text-xs">
          Correct a displayed nationality, or move a misattributed alias to the right player.
        </p>
      </div>

      <form className="mb-6">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name…"
          className="w-full max-w-sm rounded border border-rule px-3 py-2 text-sm text-ink"
        />
      </form>

      <div className="overflow-hidden rounded-lg border border-rule bg-paper">
        {rows.length === 0 ? (
          <p className="text-muted-label px-4 py-8 text-center text-sm">No players found.</p>
        ) : (
          rows.map((p) => (
            <Link
              key={p.id}
              href={`/admin/players/${p.id}`}
              className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 text-sm last:border-0 hover:bg-paper-tint"
            >
              <span className="text-ink">{p.displayName}</span>
              <span className="flex shrink-0 items-center gap-3 text-xs">
                {p.countryOverride && (
                  <span className="text-eyebrow rounded-full bg-lime/20 px-2 py-0.5 text-ink">
                    displaying {p.countryOverride}
                  </span>
                )}
                <span className="text-muted-label">{p.aliasCount} alias{p.aliasCount === 1 ? "" : "es"}</span>
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
