import { CenterBar } from "./CenterBar";

export function H2HStatsRow({
  label,
  value1,
  value2,
  detail1,
  detail2,
  fixedMax,
}: {
  label: string;
  value1: number;
  value2: number;
  /** Sufijo pequeño opcional, p. ej. "/89" para mostrar "138/89" (Career W/L) sin que
   * la barra deje de representar solo el valor principal (las victorias). */
  detail1?: string;
  detail2?: string;
  /** Escala fija de la barra — para porcentajes, `100`. Sin esto la barra se escala contra
   * el mayor de los dos valores, y "75 contra 62" dibujaba el 75 % como una barra LLENA
   * y el 62 % casi llena, como si fueran 100 % (pedido del propietario, 2026-09-26:
   * "these graphs don't make a lot of sense here"). Un porcentaje mide contra 100, no
   * contra el rival. */
  fixedMax?: number;
}) {
  // El ancho de la celda del número es fijo en pantallas anchas (`sm:w-28`): con un
  // detalle como "(57/72)" la celda crecía y la pista de la barra de esa fila salía más
  // corta que la de otra sin detalle, así que una barra "llena" no medía lo mismo en
  // todas las filas.
  const max = fixedMax ?? Math.max(value1, value2, 1);
  return (
    <div className="grid grid-cols-2 items-center gap-x-3 gap-y-2 border-b border-white/10 py-4 last:border-0 sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
      <div className="col-start-1 row-start-2 flex items-center gap-3 sm:row-start-1">
        <span className="tour-numeric text-headline min-w-16 shrink-0 text-right text-lg text-white sm:w-28">
          {value1}
          {detail1 && <span className="text-muted-label block text-sm font-normal sm:inline">{detail1}</span>}
        </span>
        <CenterBar value={value1} max={max} color="var(--blue-500)" fromRight />
      </div>
      <span className="text-eyebrow col-span-2 row-start-1 px-2 text-center text-[11px] text-white/60 sm:col-span-1 sm:col-start-2">{label}</span>
      <div className="col-start-2 row-start-2 flex items-center gap-3 sm:col-start-3 sm:row-start-1">
        <CenterBar value={value2} max={max} color="var(--accent-500)" fromRight={false} />
        <span className="tour-numeric text-headline min-w-16 shrink-0 text-lg text-white sm:w-28">
          {value2}
          {detail2 && <span className="text-muted-label block text-sm font-normal sm:inline">{detail2}</span>}
        </span>
      </div>
    </div>
  );
}
