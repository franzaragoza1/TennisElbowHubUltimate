import Image from "next/image";
import Link from "next/link";

/**
 * Banda de marca: reproduce `public/assets/header.png` (1920×380, fondo cian con el
 * wordmark a la derecha, sin la bola TE4 de la versión anterior) montada como una franja
 * de altura fija en vez de estirar el PNG completo.
 *
 * Va en `bg-accent-500` y no en un tono aparte: la muestra de color del `header.png`
 * nuevo (`#00dac0`) es, a efectos prácticos, el mismo cian que ya es el acento del
 * resto del sitio — a diferencia de la versión anterior (banda en lime, acento en cian),
 * ya no hace falta un color dedicado solo para esta banda.
 */
const SIZES = {
  compact: { band: "h-16", wordmark: "h-9" },
  hero: { band: "h-28 sm:h-40", wordmark: "h-14 sm:h-20" },
} as const;

export function BrandBar({ size = "compact" }: { size?: "compact" | "hero" }) {
  const s = SIZES[size];

  return (
    <div className="w-full bg-accent-500">
      <div className={`tour-container flex ${s.band} items-center justify-end`}>
        <Link
          href="/"
          aria-label="XKT World Tour — home"
          className="flex shrink-0 items-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-navy-900"
        >
          <Image
            src="/assets/logo.png"
            alt="XKT World Tour"
            width={476}
            height={300}
            priority={size === "hero"}
            className={`${s.wordmark} w-auto`}
          />
        </Link>
      </div>
    </div>
  );
}
