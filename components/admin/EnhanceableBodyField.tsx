"use client";

import { RichTextEditor } from "@/components/admin/RichTextEditor";

/** El campo Body + el botón "Enhance with AI" — mismo marcado en NewsForm.tsx y
 * ReporterStoryForm.tsx (ver useEnhanceNewsDraft.ts para la lógica compartida). */
export function EnhanceableBodyField({
  bodyContent,
  bodyVersion,
  isEnhancing,
  enhanceError,
  onEnhanceClick,
}: {
  bodyContent: string;
  bodyVersion: number;
  isEnhancing: boolean;
  enhanceError: string | null;
  onEnhanceClick: () => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-eyebrow block text-xs text-muted-label">Body</span>
        <button
          type="button"
          onClick={onEnhanceClick}
          disabled={isEnhancing}
          className="text-eyebrow text-xs text-blue-500 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isEnhancing ? "Enhancing…" : "Enhance with AI"}
        </button>
      </div>
      <RichTextEditor key={bodyVersion} name="body" initialContent={bodyContent} placeholder="Write the story…" />
      <span className="text-muted-label mt-1 block text-xs">
        Write at least a rough draft above first — this polishes your own content (and can weave in a real
        interview quote if one exists for a tagged player at this tournament), it never invents the story itself.
      </span>
      {enhanceError && <p className="text-down mt-1 text-xs">{enhanceError}</p>}
    </div>
  );
}
