import { CenterBar } from "./CenterBar";
import type { H2HPlayerInfo } from "./H2HHeader";
import type { WinProbability } from "@/lib/predictor/preMatchModel";

/** Win% calculado a partir de diferencia de ranking, historial H2H, forma reciente y
 * récord de carrera (lib/predictor/preMatchModel.ts) — nunca lo decide un modelo de
 * lenguaje, ver el comentario del mismo archivo. Barra compartida con el resto del H2H
 * (CenterBar) para el mismo lenguaje visual azul/lima que ya usa toda la página. */
export function H2HWinPrediction({
  player1,
  player2,
  winProbability,
}: {
  player1: H2HPlayerInfo;
  player2: H2HPlayerInfo;
  winProbability: WinProbability;
}) {
  const pct1 = Math.round(winProbability.player1 * 100);
  const pct2 = 100 - pct1;

  return (
    <div className="rounded-lg bg-white/5 p-5">
      <p className="text-eyebrow mb-3 text-center text-[10px] text-white/50">Win prediction</p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="tour-numeric text-headline min-w-12 shrink-0 text-right text-lg text-white">{pct1}%</span>
          <CenterBar value={pct1} max={100} color="var(--blue-500)" fromRight />
        </div>
        <span className="text-eyebrow px-1 text-center text-[10px] text-white/40">vs</span>
        <div className="flex items-center gap-3">
          <CenterBar value={pct2} max={100} color="var(--accent-500)" fromRight={false} />
          <span className="tour-numeric text-headline min-w-12 shrink-0 text-lg text-white">{pct2}%</span>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-4">
        <span className="text-muted-label min-w-12 truncate text-xs text-white/50">{player1.displayName}</span>
        <span className="text-muted-label min-w-12 truncate text-right text-xs text-white/50">{player2.displayName}</span>
      </div>
    </div>
  );
}
