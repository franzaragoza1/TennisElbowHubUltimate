import Image from "next/image";
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
    <div className="mb-8">
      <p className="text-headline -mb-1 text-lg text-ink">The Cap Says:</p>
      <div className="relative rounded-lg border border-rule bg-paper p-4 shadow-sm">
        {/* A pie del borde superior a propósito, no dentro del flujo normal — pedido
         * explícito ("literally sitting on the border of the box"). */}
        <Image
          src="/assets/cap/cap.png"
          alt=""
          width={1254}
          height={1254}
          className="absolute -top-7 left-4 h-16 w-16 drop-shadow-md"
        />
        <p className="text-ink mb-3 text-sm leading-relaxed">{overview.overview}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {overview.strengths.length > 0 && (
            <div>
              <p className="text-eyebrow mb-1.5 text-[10px] text-up">Strengths</p>
              <ul className="flex flex-col gap-1.5">
                {overview.strengths.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink">
                    <span aria-hidden="true" className="text-up">
                      +
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {overview.downsides.length > 0 && (
            <div>
              <p className="text-eyebrow mb-1.5 text-[10px] text-down">Downsides</p>
              <ul className="flex flex-col gap-1.5">
                {overview.downsides.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink">
                    <span aria-hidden="true" className="text-down">
                      &minus;
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="mt-3 flex justify-end">
          <p className="text-eyebrow text-[10px] text-muted-label">Only visible to you</p>
        </div>
      </div>
    </div>
  );
}
