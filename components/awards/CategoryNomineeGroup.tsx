import { NomineeCard } from "@/components/awards/NomineeCard";
import type { AwardCategory } from "@/lib/awards/catalog";
import type { NominationDisplay } from "@/lib/awards/queries";

/**
 * Un grupo de nominados de UNA categoría — solo lectura. La votación de verdad pasa
 * en un sondeo real de Discord (lib/discordBot/tasks/announceAwardsVotingOpened.ts),
 * no aquí — pedido explícito del propietario, "the poll must be on discord, then the
 * bot reads results when it gets closed and posts on the website". Mientras el
 * período sigue en votación no se enseña ningún recuento (`results` viene undefined);
 * una vez cerrado, `results` trae el recuento y el ganador ya decididos por el sondeo.
 */
export function CategoryNomineeGroup({
  category,
  nominees,
  results,
  discordLink,
}: {
  category: AwardCategory;
  nominees: NominationDisplay[];
  results?: { nominees: (NominationDisplay & { voteCount: number })[]; winner: (NominationDisplay & { voteCount: number }) | null };
  /** Enlace al sondeo real de Discord de esta categoría — solo tiene sentido mientras
   * sigue en votación (ver lib/awards/format.ts::discordPollLink). */
  discordLink?: string | null;
}) {
  const rows: (NominationDisplay & { voteCount?: number })[] = results?.nominees ?? nominees;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-headline text-lg text-ink">
          {category.emoji} {category.label}
        </h2>
        {!results && discordLink && (
          <a href={discordLink} target="_blank" rel="noopener noreferrer" className="text-eyebrow shrink-0 rounded-full bg-navy-900 px-4 py-1.5 text-xs text-white hover:bg-navy-800">
            Vote on Discord ↗
          </a>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((n) => (
          <NomineeCard key={n.id} nominee={n} voteCount={n.voteCount} showVoteCount={Boolean(results)} isWinner={results?.winner?.id === n.id} />
        ))}
      </div>
    </section>
  );
}
