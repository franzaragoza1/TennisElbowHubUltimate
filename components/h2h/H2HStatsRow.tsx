import { CenterBar } from "./CenterBar";

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
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-white/10 py-4 last:border-0">
      <div className="flex items-center gap-3">
        <span className="tour-numeric text-headline w-16 shrink-0 text-right text-lg text-white">
          {value1}
          {detail1 && <span className="text-muted-label text-sm font-normal">{detail1}</span>}
        </span>
        <CenterBar value={value1} max={max} color="var(--blue-500)" fromRight />
      </div>
      <span className="text-eyebrow px-2 text-center text-[11px] text-white/60">{label}</span>
      <div className="flex items-center gap-3">
        <CenterBar value={value2} max={max} color="var(--accent-500)" fromRight={false} />
        <span className="tour-numeric text-headline w-16 shrink-0 text-lg text-white">
          {value2}
          {detail2 && <span className="text-muted-label text-sm font-normal">{detail2}</span>}
        </span>
      </div>
    </div>
  );
}
