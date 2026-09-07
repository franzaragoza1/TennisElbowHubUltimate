import {
  approveSuggestion,
  dismissSuggestion,
  getPendingNameSuggestions,
  getRecentMatchLogFiles,
  refreshMatchLogFile,
} from "@/app/admin/match-log/actions";
import { MatchLogUploadForm } from "@/components/admin/matchlog/MatchLogUploadForm";
import { DeleteMatchLogFileButton } from "@/components/admin/matchlog/DeleteMatchLogFileButton";
import { NameSuggestionScanForm } from "@/components/admin/matchlog/NameSuggestionScanForm";

export const dynamic = "force-dynamic";

export default async function AdminMatchLogPage() {
  const [recent, suggestions] = await Promise.all([getRecentMatchLogFiles(30), getPendingNameSuggestions()]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-headline text-2xl text-ink">Match Stats</h1>
        <p className="text-muted-label text-xs">
          Backfill real per-match stats (aces, serve %, winners, unforced errors...) into already-recorded tour
          matches, sourced from players&apos; local TE4 match logs.
        </p>
      </div>

      <MatchLogUploadForm />

      <section className="mt-8">
        <h2 className="text-headline mb-1 text-lg text-ink">Suggested name matches</h2>
        <p className="text-muted-label mb-3 text-xs">
          Scans every unresolved name from uploaded files and asks AI whether it&apos;s plausibly a nickname, old
          name, or spelling variant of a real tour player. Nothing is applied automatically — approve or dismiss
          each one below. Approving adds it as a known name (same as doing it by hand on a player&apos;s page) and
          re-processes any file that had it.
        </p>
        <NameSuggestionScanForm />

        {suggestions.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-rule bg-paper">
            {suggestions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 text-sm last:border-0">
                <div className="min-w-0">
                  <p className="text-ink">
                    &quot;{s.unresolvedName}&quot; → <span className="font-semibold">{s.suggestedPlayerName}</span>
                  </p>
                  {s.reason && <p className="text-muted-label text-xs">{s.reason}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <form action={approveSuggestion}>
                    <input type="hidden" name="suggestionId" value={s.id} />
                    <button type="submit" className="text-eyebrow text-xs text-blue-500 hover:underline">
                      Approve
                    </button>
                  </form>
                  <form action={dismissSuggestion}>
                    <input type="hidden" name="suggestionId" value={s.id} />
                    <button type="submit" className="text-eyebrow text-xs text-down hover:underline">
                      Dismiss
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-headline mb-3 text-lg text-ink">Uploaded files</h2>
        {recent.length === 0 ? (
          <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-8 text-center text-sm">
            Nothing uploaded yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-rule bg-paper">
            {recent.map((file) => (
              <div key={file.id} className="border-b border-rule px-4 py-3 text-sm last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-muted-label tour-numeric mr-1.5 text-xs">#{file.id}</span>
                    <span className="text-ink truncate">{file.fileName}</span>
                    <span className="text-eyebrow ml-2 rounded-full bg-paper-tint px-2 py-0.5 text-[10px] text-muted-label">
                      {file.uploadedByName ?? "Admin upload"}
                    </span>
                    <span className="text-muted-label ml-2 text-xs">
                      uploaded {new Date(file.uploadedAt).toLocaleString()}
                      {file.lastProcessedAt.getTime() !== file.uploadedAt.getTime() &&
                        ` · refreshed ${new Date(file.lastProcessedAt).toLocaleString()}`}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-muted-label text-xs">
                      {file.totalOnlineEntries} online · {file.linked} linked · {file.skipped} skipped
                    </span>
                    <form action={refreshMatchLogFile}>
                      <input type="hidden" name="fileId" value={file.id} />
                      <button type="submit" className="text-eyebrow text-xs text-blue-500 hover:underline">
                        Refresh
                      </button>
                    </form>
                    <DeleteMatchLogFileButton fileId={file.id} />
                  </div>
                </div>
                {file.errors.length > 0 && (
                  <ul className="text-muted-label mt-2 list-disc pl-4 text-xs">
                    {file.errors.slice(0, 5).map((message, i) => (
                      <li key={i}>{message}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
