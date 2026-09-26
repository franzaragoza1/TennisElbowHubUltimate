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
        <path
          key={i}
          d={c.d}
          fill="none"
          stroke={c.highlighted ? "var(--color-blue-500)" : "var(--color-rule)"}
          strokeWidth={c.highlighted ? 3 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
