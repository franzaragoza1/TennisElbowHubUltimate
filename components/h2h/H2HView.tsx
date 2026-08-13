import { Suspense } from "react";
import { H2HHeader, type H2HPlayerInfo } from "./H2HHeader";
import { H2HNarrative } from "./H2HNarrative";
import { H2HStatsRow } from "./H2HStatsRow";
import { H2HSplitTable } from "./H2HSplitTable";
import { H2HMatchHistory, type H2HMatchRow } from "./H2HMatchHistory";
import type { CareerStats, H2HBreakdown } from "@/lib/h2hStats";

export interface H2HViewData {
  player1: H2HPlayerInfo;
  player2: H2HPlayerInfo;
  player1Wins: number;
  player2Wins: number;
  stats1: CareerStats;
  stats2: CareerStats;
  breakdown: H2HBreakdown;
  history: H2HMatchRow[];
}

function MeetingStat({ label, value1, value2 }: { label: string; value1: string; value2: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 py-2.5 last:border-0">
      <span className="tour-numeric text-headline w-16 text-white">{value1}</span>
      <span className="text-eyebrow flex-1 text-center text-[11px] text-white/50">{label}</span>
      <span className="tour-numeric text-headline w-16 text-right text-white">{value2}</span>
    </div>
  );
}

export function H2HView({ data }: { data: H2HViewData }) {
  const { player1, player2, breakdown, stats1, stats2, history } = data;
  const hasMeetings = history.length > 0;

  const streakName =
    breakdown.streakPlayerId === player1.id
      ? player1.displayName
      : breakdown.streakPlayerId === player2.id
        ? player2.displayName
        : null;

  return (
    <div>
      <H2HHeader
        player1={player1}
        player2={player2}
        player1Wins={data.player1Wins}
        player2Wins={data.player2Wins}
      />

      {/* El enfrentamiento: solo lo que ha pasado entre estos dos */}
      {hasMeetings && (
        <div className="bg-navy-800 pb-12 pt-10">
          <Suspense fallback={null}>
            <H2HNarrative data={data} />
          </Suspense>

          <div className="tour-container tour-container--reading">
            <h2 className="text-headline mb-6 mt-6 text-lg text-white">The rivalry</h2>

            <div className="mb-8 rounded-lg bg-white/5 p-5">
              <MeetingStat
                label="Sets won"
                value1={String(breakdown.player1Sets)}
                value2={String(breakdown.player2Sets)}
              />
              <MeetingStat
                label="Games won"
                value1={String(breakdown.player1Games)}
                value2={String(breakdown.player2Games)}
              />
              <MeetingStat
                label="Tie-breaks won"
                value1={String(breakdown.player1Tiebreaks)}
                value2={String(breakdown.player2Tiebreaks)}
              />
            </div>

            {streakName && breakdown.streakCount > 1 && (
              <p className="mb-8 rounded-lg border border-accent-500/30 bg-accent-500/10 px-4 py-3 text-sm text-white">
                <span className="text-headline">{streakName}</span> has won the last{" "}
                <span className="tour-numeric text-headline">{breakdown.streakCount}</span> meetings.
              </p>
            )}

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              <H2HSplitTable title="By surface" rows={breakdown.bySurface} />
              <H2HSplitTable title="By category" rows={breakdown.byCategory} />
              <H2HSplitTable title="By round" rows={breakdown.byRound} />
            </div>
          </div>
        </div>
      )}

      {/* Comparativa de carrera */}
      <div className="bg-navy-900 py-10">
        <div className="tour-container tour-container--reading">
          <h2 className="text-headline mb-4 text-lg text-white">Career comparison</h2>
          <H2HStatsRow
            label="This year W/L"
            value1={stats1.yearWins}
            value2={stats2.yearWins}
            detail1={`/${stats1.yearLosses}`}
            detail2={`/${stats2.yearLosses}`}
          />
          <H2HStatsRow
            label="Titles this year"
            value1={stats1.yearTitles}
            value2={stats2.yearTitles}
          />
          <H2HStatsRow
            label="Career W/L"
            value1={stats1.careerWins}
            value2={stats2.careerWins}
            detail1={`/${stats1.careerLosses}`}
            detail2={`/${stats2.careerLosses}`}
          />
          <H2HStatsRow
            label="Win %"
            value1={stats1.winPct}
            value2={stats2.winPct}
            detail1="%"
            detail2="%"
          />
          <H2HStatsRow
            label="Career titles"
            value1={stats1.careerTitles}
            value2={stats2.careerTitles}
          />
          <H2HStatsRow
            label="Finals played"
            value1={stats1.careerFinals}
            value2={stats2.careerFinals}
          />
          <H2HStatsRow
            label="Weeks in top 10"
            value1={stats1.weeksTop10}
            value2={stats2.weeksTop10}
          />
          <H2HStatsRow
            label="Tournaments played"
            value1={stats1.tournamentsPlayed}
            value2={stats2.tournamentsPlayed}
          />
        </div>
      </div>

      <div className="tour-container py-10">
        <h2 className="text-headline mb-4 text-lg text-navy-900">Every meeting</h2>
        <H2HMatchHistory rows={history} />
      </div>
    </div>
  );
}
