import { addPlayerKnownName, deletePlayerKnownName, type PlayerKnownNameRow } from "@/app/admin/players/actions";

export function KnownNamesForm({ playerId, knownNames }: { playerId: number; knownNames: PlayerKnownNameRow[] }) {
  return (
    <div className="rounded-lg border border-rule bg-paper p-4">
      <p className="text-muted-label mb-3 text-xs">
        Other names this player might show up as in an uploaded MatchLog file — an old name from before a rename,
        a nickname, or TE4&apos;s own &quot;N.Surname&quot; abbreviation. Add one here and any file (already
        uploaded or future) with that exact name resolves automatically.
      </p>

      {knownNames.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {knownNames.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-ink">{k.name}</span>
              <form action={deletePlayerKnownName}>
                <input type="hidden" name="id" value={k.id} />
                <input type="hidden" name="playerId" value={playerId} />
                <button type="submit" className="text-eyebrow text-xs text-down hover:underline">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={addPlayerKnownName} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="playerId" value={playerId} />
        <input
          type="text"
          name="name"
          placeholder="e.g. M.Girardi"
          className="w-56 rounded border border-rule px-2 py-1 text-sm text-ink"
        />
        <button type="submit" className="text-eyebrow rounded-full bg-navy-900 px-4 py-1.5 text-xs text-white hover:bg-navy-800">
          Add
        </button>
      </form>
    </div>
  );
}
