import { TOURNAMENT_STATUS_LABEL, type TournamentStatus } from "@/lib/tournamentStatus";

/** Compartido entre `TournamentCard`, la ficha de torneo y el panel de admin — un
 * torneo "completed" no lleva insignia (el campeón ya cuenta esa historia), solo
 * "registration"/"ongoing" necesitan decirlo explícitamente. */
const STYLE: Record<Exclude<TournamentStatus, "completed">, string> = {
  registration: "bg-blue-500/10 text-blue-500",
  ongoing: "bg-up/15 text-up",
};

export function TournamentStatusBadge({ status, className = "" }: { status: TournamentStatus; className?: string }) {
  if (status === "completed") return null;
  return (
    <span
      className={`text-eyebrow inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${STYLE[status]} ${className}`}
    >
      {status === "ongoing" && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-up" aria-hidden="true" />}
      {TOURNAMENT_STATUS_LABEL[status]}
    </span>
  );
}
