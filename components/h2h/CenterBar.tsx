/**
 * Media barra que crece desde el centro hacia un lado, proporcional a `value` contra
 * el mayor de los dos valores que se están comparando (`max`) — no contra la suma de
 * los dos. Compartida por `H2HStatsRow` y `H2HSplitTable` para que las dos usen el
 * mismo lenguaje visual en toda la página del H2H (antes `H2HSplitTable` usaba una
 * barra apilada de ancho fijo — "1 contra 0" llenaba la barra entera igual que
 * "60 contra 40", dando el mismo peso visual a una muestra de un partido que a una de
 * cien).
 */
export function CenterBar({
  value,
  max,
  color,
  fromRight,
}: {
  value: number;
  max: number;
  color: string;
  fromRight: boolean;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div
      className={`h-2.5 flex-1 overflow-hidden rounded-full bg-white/10 ${fromRight ? "flex justify-end" : ""}`}
    >
      <div
        className="bar-grow h-2.5 rounded-full"
        style={{ "--bar-pct": `${pct}%`, backgroundColor: color } as React.CSSProperties}
      />
    </div>
  );
}
