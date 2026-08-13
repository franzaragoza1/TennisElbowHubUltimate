"use client";

export function RoundChips({
  labels,
  activeIndex,
  onSelect,
}: {
  labels: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {labels.map((label, i) => (
        <button
          key={label + i}
          type="button"
          onClick={() => onSelect(i)}
          className={`text-eyebrow shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
            i === activeIndex
              ? "border-navy-900 bg-navy-900 text-white"
              : "border-rule text-muted-label hover:border-navy-900 hover:text-navy-900"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
