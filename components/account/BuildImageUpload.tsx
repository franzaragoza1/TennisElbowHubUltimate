"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ReactCrop, { centerCrop, type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { extractBuildStats, uploadBuildImage, type UpdatePlayerBuildInput } from "@/app/account/actions";

const MAX_DIMENSION = 480;
// Bastante más grande que el recorte del personaje — este es el screenshot COMPLETO
// (menús, barras, fondo), guardado solo como referencia privada del propio jugador
// (nunca sujeto a `isPublic`, ver db/schema.ts::originalScreenshotUrl).
const MAX_ORIGINAL_DIMENSION = 1600;
// El tamaño que de verdad se manda a leer por IA (lib/buildScreenshotOcr.ts) — nunca
// el screenshot en su resolución real. Un modelo con visión cobra por "tiles" de la
// imagen: mandar un screenshot de referencia real (2560×1440 en las capturas de esta
// sesión) sin reescalar costaba de verdad bastante más de lo esperado (comprobado
// contra el panel de uso real de OpenRouter tras las primeras pruebas) — 1024px de
// lado largo sigue dejando los números de cada barra perfectamente legibles y corta
// el número de tiles de forma notable.
const MAX_OCR_DIMENSION = 1024;
const JPEG_QUALITY = 0.85;

/**
 * Recorta la región elegida (en px sobre la imagen TAL COMO SE VE, no su resolución
 * real) y la reescala a como mucho MAX_DIMENSION por el lado largo — mismo criterio
 * que components/account/AvatarUpload.tsx::resizeAndCompress. A propósito NO se usa
 * `cropToCanvas` de la propia librería: esa función escala también por
 * `window.devicePixelRatio`, que en una pantalla de alta densidad daría un canvas
 * bastante más grande de lo necesario para un recorte pequeño — este cálculo a mano
 * hace el recorte y el reescalado en el mismo `drawImage`, sin ese problema.
 */
function cropToDataUri(image: HTMLImageElement, crop: PixelCrop): string {
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const sourceWidth = crop.width * scaleX;
  const sourceHeight = crop.height * scaleY;

  const scale = Math.min(1, MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images here.");

  ctx.drawImage(image, crop.x * scaleX, crop.y * scaleY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

/** Igual idea que `cropToDataUri` pero sin recorte — la imagen entera, solo
 * reescalada, para guardar como referencia privada. */
function resizeWholeImageToDataUri(image: HTMLImageElement, maxDimension: number): string {
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images here.");

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

/** Carga un data URI en un `<img>` desnudo (sin montar, sin `ref`) y espera a que
 * tenga `naturalWidth`/`naturalHeight` listos — hace falta ANTES de reescalar para
 * la lectura por IA, en el momento en que se elige el archivo, cuando el `<img>` del
 * propio recortador todavía no existe en el DOM. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't process that image."));
    img.src = src;
  });
}

/**
 * Sube el Character Sheet entero — se manda a leer sus estadísticas por IA con
 * visión (`onExtracted`, no bloqueante) EN PARALELO a que el jugador recorta su
 * propio personaje, pero reescalado a MAX_OCR_DIMENSION antes de mandarlo (más abajo
 * en handleFileChange) — nunca su resolución real, que encarecía la llamada de
 * verdad más de lo esperado (comprobado contra el panel de uso real de OpenRouter).
 * Solo el recorte y el screenshot completo reescalado a un tamaño más generoso se
 * guardan (`uploadBuildImage`); el screenshot en su resolución original nunca sale
 * del navegador salvo para esa lectura puntual, ya reescalada. Sin regeneración por
 * IA a propósito (pedido explícito): el recorte es llano, nada generativo — solo la
 * LECTURA de las
 * estadísticas pasa por un modelo.
 */
export function BuildImageUpload({
  currentImageUrl,
  onExtracted,
}: {
  currentImageUrl: string | null;
  onExtracted: (data: Partial<UpdatePlayerBuildInput>) => void;
}) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [preview, setPreview] = useState<string | null>(currentImageUrl);
  const [error, setError] = useState<string | null>(null);
  const [extractionNote, setExtractionNote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isExtracting, startExtracting] = useTransition();
  const imgRef = useRef<HTMLImageElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Evita una carrera si el jugador sube un segundo screenshot antes de que termine
  // de leerse el primero — solo el resultado del último upload debe rellenar el
  // formulario.
  const extractionTokenRef = useRef(0);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setExtractionNote(null);
    const reader = new FileReader();
    reader.onerror = () => setError("Couldn't read that file.");
    reader.onload = () => {
      const dataUri = reader.result as string;
      setImageSrc(dataUri);
      setCrop(undefined);
      setCompletedCrop(undefined);

      const token = ++extractionTokenRef.current;
      setExtractionNote("Reading stats from screenshot…");
      startExtracting(async () => {
        let ocrDataUri: string;
        try {
          const img = await loadImage(dataUri);
          ocrDataUri = resizeWholeImageToDataUri(img, MAX_OCR_DIMENSION);
        } catch {
          ocrDataUri = dataUri; // si el reescalado falla por lo que sea, se manda la original antes que no mandar nada
        }

        const { data, error } = await extractBuildStats(ocrDataUri);
        if (token !== extractionTokenRef.current) return; // un upload más reciente ya está en curso
        if (error) {
          setExtractionNote(error);
          return;
        }
        if (!data) {
          setExtractionNote("Couldn't read stats automatically — enter them below.");
          return;
        }
        onExtracted(data);
        setExtractionNote("Stats filled in below — check them before saving.");
      });
    };
    reader.readAsDataURL(file);
  }

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerCrop({ unit: "%", width: 70, height: 70 }, width, height));
  }

  function handleSave() {
    if (!imgRef.current || !completedCrop || completedCrop.width === 0 || completedCrop.height === 0) {
      setError("Drag to select the part of the screenshot you want to keep.");
      return;
    }
    setError(null);

    let croppedDataUri: string;
    let resizedOriginalDataUri: string;
    try {
      croppedDataUri = cropToDataUri(imgRef.current, completedCrop);
      resizedOriginalDataUri = resizeWholeImageToDataUri(imgRef.current, MAX_ORIGINAL_DIMENSION);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't process that image.");
      return;
    }

    startTransition(async () => {
      const { error } = await uploadBuildImage(croppedDataUri, resizedOriginalDataUri);
      if (error) {
        setError(error);
        return;
      }
      setPreview(croppedDataUri);
      setImageSrc(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {imageSrc ? (
        <div className="flex flex-col items-start gap-3">
          <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)} onComplete={(c) => setCompletedCrop(c)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- se recorta en el propio navegador, no un asset next/image */}
            <img ref={imgRef} src={imageSrc} alt="" onLoad={handleImageLoad} className="max-h-96 max-w-full" />
          </ReactCrop>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="text-eyebrow rounded-full bg-navy-900 px-6 py-2.5 text-xs text-white transition hover:bg-navy-800 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save crop"}
            </button>
            <button
              type="button"
              onClick={() => setImageSrc(null)}
              disabled={isPending}
              className="text-eyebrow text-xs text-muted-label underline decoration-dotted hover:text-ink disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa local, no un asset next/image
            <img
              src={preview}
              alt="Your in-game character"
              className="max-h-40 w-auto max-w-[10rem] shrink-0 rounded-lg border-4 border-rule object-contain"
            />
          ) : (
            <div className="text-muted-label flex h-32 w-32 shrink-0 items-center justify-center rounded-lg border-4 border-rule bg-paper-tint px-2 text-center text-xs">
              No image yet
            </div>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-eyebrow rounded-full bg-navy-900 px-6 py-2.5 text-xs text-white transition hover:bg-navy-800"
          >
            Upload Character Sheet screenshot
          </button>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileChange} />
        </div>
      )}

      {error && <p className="text-down max-w-xs text-xs">{error}</p>}
      {!error && extractionNote && (
        <p className="text-muted-label max-w-sm text-xs">
          {isExtracting && <span className="mr-1 inline-block animate-pulse">●</span>}
          {extractionNote}
        </p>
      )}
      {!error && !extractionNote && !imageSrc && (
        <p className="text-muted-label max-w-sm text-xs">
          Upload a screenshot of your Character Sheet — your stats fill in automatically below, and you drag the box
          here to select just your character.
        </p>
      )}
    </div>
  );
}
