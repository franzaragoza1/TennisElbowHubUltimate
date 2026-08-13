import type { ConnectorPath } from "@/lib/bracketGeometry";

export function BracketConnectors({
  connectors,
  width,
  height,
}: {
  connectors: ConnectorPath[];
  width: number;
  height: number;
}) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {connectors.map((c, i) => (
        <path key={i} d={c.d} fill="none" stroke="#e5e7eb" strokeWidth={2} />
      ))}
    </svg>
  );
}
