function Bar({
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
      className={`h-1.5 flex-1 rounded-full bg-white/10 ${fromRight ? "flex justify-end" : ""}`}
    >
      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export function H2HStatsRow({
  label,
  value1,
  value2,
  detail1,
  detail2,
}: {
  label: string;
  value1: number;
  value2: number;
  /** Sufijo pequeño opcional, p. ej. "/89" para mostrar "138/89" (Career W/L) sin que
   * la barra deje de representar solo el valor principal (las victorias). */
  detail1?: string;
  detail2?: string;
}) {
  const max = Math.max(value1, value2, 1);
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-white/10 py-3 last:border-0">
      <div className="flex items-center gap-3">
        <span className="tour-numeric text-headline shrink-0 text-right text-white">
          {value1}
          {detail1 && <span className="text-muted-label font-normal">{detail1}</span>}
        </span>
        <Bar value={value1} max={max} color="var(--blue-500)" fromRight />
      </div>
      <span className="text-eyebrow px-2 text-center text-[11px] text-white/60">{label}</span>
      <div className="flex items-center gap-3">
        <Bar value={value2} max={max} color="var(--accent-500)" fromRight={false} />
        <span className="tour-numeric text-headline shrink-0 text-white">
          {value2}
          {detail2 && <span className="text-muted-label font-normal">{detail2}</span>}
        </span>
      </div>
    </div>
  );
}
