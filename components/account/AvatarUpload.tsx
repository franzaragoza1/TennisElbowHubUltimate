"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadAvatar, removeCustomAvatar } from "@/app/account/actions";

const MAX_DIMENSION = 320;
const JPEG_QUALITY = 0.85;

/** Redimensiona a como mucho 320x320 (conservando proporción) y comprime a JPEG en el
 * propio navegador — el servidor nunca reprocesa la imagen (ver app/account/actions.ts),
 * así que lo que llega ahí ya tiene que ser pequeño. `<canvas>` nativo, sin librería:
 * de sobra para redimensionar una foto de perfil. */
function resizeAndCompress(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That doesn't look like a valid image."));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Your browser can't process images here."));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function AvatarUpload({
  currentAvatarUrl,
  isCustom,
  discordAvatarUrl,
}: {
  currentAvatarUrl: string | null;
  isCustom: boolean;
  /** Foto de Discord tal como la ve la sesión actual — para poder mostrarla al
   * instante al pulsar "Use Discord photo instead", sin esperar a que la página
   * vuelva a pedir los datos. */
  discordAvatarUrl: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl);
  const [isCustomNow, setIsCustomNow] = useState(isCustom);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    let dataUri: string;
    try {
      dataUri = await resizeAndCompress(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't process that image.");
      return;
    }

    setPreview(dataUri);
    setIsCustomNow(true);
    startTransition(async () => {
      const { error } = await uploadAvatar(dataUri);
      if (error) {
        setError(error);
        setPreview(currentAvatarUrl);
        setIsCustomNow(isCustom);
        return;
      }
      router.refresh();
    });
  }

  function handleRemove() {
    setError(null);
    setPreview(discordAvatarUrl);
    setIsCustomNow(false);
    startTransition(async () => {
      await removeCustomAvatar();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- vista previa local o foto remota de Discord, no un asset next/image
        <img src={preview} alt="Your avatar" className="h-32 w-32 shrink-0 rounded-full border-4 border-rule object-cover" />
      ) : (
        <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full border-4 border-rule bg-accent-500 text-navy-900">
          No photo
        </div>
      )}

      <div className="flex flex-col items-center gap-2 sm:items-start">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
          className="text-eyebrow rounded-full bg-navy-900 px-6 py-2.5 text-xs text-white transition hover:bg-navy-800 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Upload a photo"}
        </button>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileChange} />

        {isCustomNow && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isPending}
            className="text-eyebrow text-xs text-muted-label underline decoration-dotted hover:text-ink disabled:opacity-50"
          >
            Use Discord photo instead
          </button>
        )}

        {error && <p className="text-down max-w-xs text-xs">{error}</p>}
        {!error && <p className="text-muted-label max-w-xs text-xs">JPEG, PNG or WebP. Resized automatically.</p>}
      </div>
    </div>
  );
}
