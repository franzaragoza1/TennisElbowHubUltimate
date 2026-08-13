import Image from "next/image";
import Link from "next/link";

/**
 * Banda de marca: reproduce `public/assets/header.png` (bola TE4 a la izquierda,
 * wordmark a la derecha sobre lime) pero montada con las dos piezas sueltas, para que
 * funcione a cualquier ancho en vez de estirar un PNG de 1920.
 *
 * Sigue en `bg-lime` a propósito, aunque el resto del sitio dejó el lime como acento
 * (ver `--accent-500` en globals.css): `ball.png` y `logo.png` son PNG con ese verde
 * grabado en los píxeles del logotipo, así que la banda tiene que quedarse en ese tono
 * exacto o el logotipo desentona contra su propio fondo. Va sobre lime y no sobre el
 * navy de la barra de navegación por lo mismo: el wordmark es navy con filete lime y
 * sobre fondo oscuro se vuelve ilegible.
 */
const SIZES = {
  compact: {
    band: "h-16",
    ball: 44,
    wordmark: "h-9",
  },
  hero: {
    band: "h-28 sm:h-40",
    ball: 96,
    wordmark: "h-14 sm:h-20",
  },
} as const;

export function BrandBar({ size = "compact" }: { size?: "compact" | "hero" }) {
  const s = SIZES[size];

  return (
    <div className="w-full bg-lime">
      <div
        className={`tour-container flex ${s.band} items-center justify-between`}
      >
        <Link
          href="/"
          aria-label="XKT World Tour — home"
          className="flex shrink-0 items-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-navy-900"
        >
          <Image
            src="/assets/ball.png"
            alt=""
            width={s.ball}
            height={s.ball}
            priority={size === "hero"}
            className="h-auto"
            style={{ width: s.ball, height: s.ball }}
          />
        </Link>
        <Image
          src="/assets/logo.png"
          alt="XKT World Tour"
          width={476}
          height={300}
          priority={size === "hero"}
          className={`${s.wordmark} w-auto`}
        />
      </div>
    </div>
  );
}
