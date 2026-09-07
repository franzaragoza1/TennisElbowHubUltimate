import type { PlayerOverviewResult } from "@/lib/playerOverview";

/**
 * Vive en /account, no en la ficha pública — pedido explícito del propietario: el
 * párrafo "cómo te va" con consejos es personal (piensa en él como coaching privado),
 * a diferencia de la bio/palmarés/redes que el propio jugador rellena para que se
 * vean en su ficha pública. Igual criterio que H2HWidget/el párrafo de rivalidad: si
 * `getPlayerOverview` devolvió null (sin GROQ_API_KEY, timeout, respuesta
 * ilegible...) la sección simplemente no aparece, nunca un hueco vacío ni un error
 * visible.
 */
export function PlayerOverviewCard({ overview }: { overview: PlayerOverviewResult | null }) {
  if (!overview) return null;

  return (
    <div className="mb-8 rounded-lg border border-rule bg-paper p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-eyebrow text-[10px] text-muted-label">How you&apos;re doing</p>
        <p className="text-eyebrow text-[10px] text-muted-label">Only visible to you</p>
      </div>
      <p className="text-ink mb-3 text-sm leading-relaxed">{overview.overview}</p>
      <ul className="flex flex-col gap-1.5">
        {overview.tips.map((tip, i) => (
          <li key={i} className="flex gap-2 text-sm text-ink">
            <span aria-hidden="true" className="text-blue-500">
              &middot;
            </span>
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}
