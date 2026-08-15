import { FinalsMatchCard, FINALS_CARD_HEIGHT, type FinalsMatchCardData } from "./FinalsMatchCard";

/** Las dos semis (SF1 arriba, SF2 abajo) alimentan la Final, centrada entre ambas —
 * mismo lenguaje visual que el cuadro principal (`BracketConnectors`), pero sin
 * necesidad de su motor de geometría genérico: aquí la forma es siempre la misma
 * (2 semis → 1 final), así que las coordenadas del conector salen de las constantes
 * de `FinalsMatchCard` en vez de medirse en el DOM. */
const GAP = 32;
const CONNECTOR_WIDTH = 40;

export interface KnockoutSlotMatch extends FinalsMatchCardData {
  slot: "SF1" | "SF2" | "F";
}

export function FinalsKnockoutBracket({ matches }: { matches: KnockoutSlotMatch[] }) {
  const sf1 = matches.find((m) => m.slot === "SF1");
  const sf2 = matches.find((m) => m.slot === "SF2");
  const final = matches.find((m) => m.slot === "F");

  // Forma inesperada (formato distinto, datos incompletos): se enseña en fila simple en
  // vez de asumir una geometría de 2-semis-1-final que no aplica.
  if (!sf1 || !sf2 || !final) {
    return (
      <div className="flex flex-wrap gap-4">
        {matches.map((m) => (
          <FinalsMatchCard key={m.id} data={m} />
        ))}
      </div>
    );
  }

  const columnHeight = FINALS_CARD_HEIGHT * 2 + GAP;
  const sf1Mid = FINALS_CARD_HEIGHT / 2;
  const sf2Mid = FINALS_CARD_HEIGHT + GAP + FINALS_CARD_HEIGHT / 2;
  const finalMid = columnHeight / 2;
  const midX = CONNECTOR_WIDTH / 2;

  return (
    <div className="flex items-stretch overflow-x-auto">
      <div className="flex flex-col justify-between" style={{ height: columnHeight }}>
        <FinalsMatchCard data={sf1} />
        <FinalsMatchCard data={sf2} />
      </div>
      <svg
        aria-hidden="true"
        width={CONNECTOR_WIDTH}
        height={columnHeight}
        viewBox={`0 0 ${CONNECTOR_WIDTH} ${columnHeight}`}
        className="shrink-0"
      >
        <path d={`M 0 ${sf1Mid} H ${midX} V ${finalMid} H ${CONNECTOR_WIDTH}`} fill="none" stroke="var(--color-rule)" strokeWidth={2} />
        <path d={`M 0 ${sf2Mid} H ${midX} V ${finalMid} H ${CONNECTOR_WIDTH}`} fill="none" stroke="var(--color-rule)" strokeWidth={2} />
      </svg>
      <div className="flex flex-col justify-center" style={{ height: columnHeight }}>
        <FinalsMatchCard data={final} />
      </div>
    </div>
  );
}
