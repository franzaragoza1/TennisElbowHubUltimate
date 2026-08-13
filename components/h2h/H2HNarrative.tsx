import type { H2HViewData } from "./H2HView";
import { getH2HNarrative } from "@/lib/h2hNarrative";

/**
 * Se renderiza dentro de un <Suspense> para que la página pinte entera sin esperar a
 * la llamada externa. Si no hay texto (pocos cruces, API caída, sin clave) no se pinta
 * nada: la sección desaparece en vez de dejar un hueco o un error.
 */
export async function H2HNarrative({ data }: { data: H2HViewData }) {
  const narrative = await getH2HNarrative(data);
  if (!narrative) return null;

  return (
    <div className="tour-container tour-container--reading pb-2">
      <div className="border-l-2 border-accent-500 pl-4">
        <p className="text-[15px] leading-relaxed text-white/85">{narrative}</p>
      </div>
    </div>
  );
}
