export function MovedIndicator({ moved }: { moved: number }) {
  if (moved === 0) {
    return <span className="tour-numeric text-muted-label">--</span>;
  }
  const isUp = moved > 0;
  return (
    <span
      className={`tour-numeric inline-flex items-center gap-1 ${isUp ? "text-up" : "text-down"}`}
    >
      <span aria-hidden="true" className={`animate-in duration-500 ${isUp ? "slide-in-from-bottom-1" : "slide-in-from-top-1"} fade-in`}>
        {isUp ? "▲" : "▼"}
      </span>
      {Math.abs(moved)}
    </span>
  );
}
