"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AVATAR_CHOICES,
  renderAvatarDataUri,
  type AvatarOptions,
} from "@/lib/avatar";
import { saveAvatar } from "@/app/dashboard/actions";

function humanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (c) => c.toUpperCase())
    .replace(/(\d+)/g, " $1");
}

function TraitSelect<T extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: T;
  choices: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="block">
      <span className="text-eyebrow mb-1 block text-xs text-muted-label">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-md border border-rule px-2 py-1.5 text-sm text-navy-900 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/30"
      >
        {choices.map((c) => (
          <option key={c} value={c}>
            {humanize(c)}
          </option>
        ))}
      </select>
    </label>
  );
}

function OptionalTraitSelect<T extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: T | null;
  choices: readonly T[];
  onChange: (value: T | null) => void;
}) {
  return (
    <label className="block">
      <span className="text-eyebrow mb-1 block text-xs text-muted-label">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : (e.target.value as T))}
        className="w-full rounded-md border border-rule px-2 py-1.5 text-sm text-navy-900 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/30"
      >
        <option value="">None</option>
        {choices.map((c) => (
          <option key={c} value={c}>
            {humanize(c)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AvatarEditor({ initialOptions }: { initialOptions: AvatarOptions }) {
  const [options, setOptions] = useState<AvatarOptions>(initialOptions);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const previewUri = useMemo(
    () => renderAvatarDataUri(JSON.stringify(options)),
    [options],
  );

  function update<K extends keyof AvatarOptions>(key: K, value: AvatarOptions[K]) {
    setOptions((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    startTransition(async () => {
      await saveAvatar(options);
      setSaved(true);
    });
  }

  return (
    <div className="flex flex-col gap-8 sm:flex-row">
      <div className="flex shrink-0 flex-col items-center gap-4 sm:sticky sm:top-8 sm:self-start">
        {previewUri && (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa generada en cliente, no un asset estático
          <img
            src={previewUri}
            alt="Avatar preview"
            className="h-40 w-40 rounded-full border-4 border-rule"
          />
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="text-eyebrow w-full rounded-full bg-navy-900 px-6 py-2.5 text-xs text-white transition hover:bg-navy-800 disabled:opacity-50"
        >
          {isPending ? "Saving…" : saved ? "Saved ✓" : "Save avatar"}
        </button>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
        <TraitSelect label="Body" value={options.body} choices={AVATAR_CHOICES.body} onChange={(v) => update("body", v)} />
        <TraitSelect label="Hair" value={options.hair} choices={AVATAR_CHOICES.hair} onChange={(v) => update("hair", v)} />
        <TraitSelect label="Eyebrows" value={options.brows} choices={AVATAR_CHOICES.brows} onChange={(v) => update("brows", v)} />
        <TraitSelect label="Eyes" value={options.eyes} choices={AVATAR_CHOICES.eyes} onChange={(v) => update("eyes", v)} />
        <TraitSelect label="Nose" value={options.nose} choices={AVATAR_CHOICES.nose} onChange={(v) => update("nose", v)} />
        <TraitSelect label="Lips" value={options.lips} choices={AVATAR_CHOICES.lips} onChange={(v) => update("lips", v)} />
        <OptionalTraitSelect label="Glasses" value={options.glasses} choices={AVATAR_CHOICES.glasses} onChange={(v) => update("glasses", v)} />
        <OptionalTraitSelect label="Beard" value={options.beard} choices={AVATAR_CHOICES.beard} onChange={(v) => update("beard", v)} />
        <div className="sm:col-span-2">
          <OptionalTraitSelect label="Gesture" value={options.gesture} choices={AVATAR_CHOICES.gesture} onChange={(v) => update("gesture", v)} />
        </div>
      </div>
    </div>
  );
}
