export function MovedIndicator({ moved }: { moved: number }) {
  if (moved === 0) {
    return <span className="tour-numeric text-muted-label">--</span>;
  }
  const isUp = moved > 0;
  return (
    <span
      className={`tour-numeric inline-flex items-center gap-1 ${isUp ? "text-up" : "text-down"}`}
    >
      <span aria-hidden="true">{isUp ? "▲" : "▼"}</span>
      {Math.abs(moved)}
    </span>
  );
}
