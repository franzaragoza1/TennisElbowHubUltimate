import type { InterviewTranscript as InterviewTranscriptData } from "@/lib/newsQueries";
import { LinkifiedText } from "@/components/LinkifiedText";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";

/** `<details>` nativo, sin JS propio — el mismo criterio ligero que el resto del
 * sitio para cualquier cosa que solo necesita abrir/cerrar. Solo se monta cuando
 * `lib/newsQueries.ts::getNewsBySlug` ya confirmó que el artículo viene de una
 * entrevista real y esta trae al menos una respuesta. */
export function InterviewTranscript({ transcript }: { transcript: InterviewTranscriptData }) {
  return (
    <details className="mt-10 rounded-lg border border-rule bg-paper-tint">
      <summary className="text-headline cursor-pointer px-5 py-4 text-sm text-ink">
        Read the full interview with {transcript.playerName}
      </summary>
      <div className="border-t border-rule px-5 py-5">
        <p className="text-muted-label mb-5 text-xs">Post-match interview after facing {transcript.opponentName}.</p>
        <div className="space-y-5">
          {transcript.qa.map((pair, i) => (
            <div key={i}>
              <p className="text-eyebrow text-xs text-muted-label">Question</p>
              <p className="text-ink mb-3">{pair.question}</p>
              <div className="flex items-start gap-2.5">
                <PlayerAvatar
                  displayName={transcript.playerName}
                  country={transcript.playerCountry}
                  avatarUrl={transcript.playerAvatarUrl}
                  size="sm"
                />
                <div className="min-w-0 flex-1 pt-1">
                  <p className="text-eyebrow text-xs text-muted-label">{transcript.playerName}</p>
                  <p className="text-ink">
                    <LinkifiedText text={pair.answer} />
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
