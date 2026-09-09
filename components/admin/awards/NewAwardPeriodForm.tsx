"use client";

import { useState, useTransition } from "react";
import { createAwardPeriod } from "@/app/admin/awards/actions";

const inputClass =
  "w-full rounded-lg border border-rule bg-paper px-3 py-2 text-ink outline-none focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-eyebrow mb-1 block text-xs text-muted-label">{label}</span>
      {children}
    </label>
  );
}

const MONTH_LABELS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function NewAwardPeriodForm({ onCreated }: { onCreated: (periodId: number) => void }) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const { error, periodId } = await createAwardPeriod(formData);
      if (error || periodId === null) {
        setError(error ?? "Something went wrong.");
        return;
      }
      onCreated(periodId);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Cycle">
          <select name="cycle" value={cycle} onChange={(e) => setCycle(e.target.value as "monthly" | "yearly")} className={inputClass}>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </Field>
        <Field label="Year">
          <input name="year" type="number" required defaultValue={new Date().getFullYear()} className={inputClass} />
        </Field>
      </div>

      {cycle === "monthly" && (
        <Field label="Month">
          <select name="month" defaultValue={new Date().getMonth() + 1} className={inputClass}>
            {MONTH_LABELS.map((label, i) => (
              <option key={label} value={i + 1}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="text-eyebrow rounded-full bg-navy-900 px-6 py-2.5 text-xs text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? "Creating…" : "Create period"}
        </button>
        {error && <p className="text-down text-xs">{error}</p>}
      </div>
    </form>
  );
}
