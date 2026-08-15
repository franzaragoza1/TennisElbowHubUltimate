"use client";

import Image from "next/image";
import Link from "next/link";
import { PARTNER_LINKS } from "@/lib/partnerLinks";
import { useImageExists } from "@/lib/useImageExists";

/**
 * Banda de marca: monta el wordmark sobre una franja de altura fija en el color de
 * acento del sitio (`bg-accent-500`, ver app/globals.css) en vez de un tono aparte —
 * así la banda cambia de golpe si el acento vuelve a cambiar, sin tocar este fichero.
 * El wordmark en sí (`logo.png`) es navy con un filete lima fino en el trazo, así que
 * lee bien sobre cualquier acento razonablemente claro.
 *
 * El wordmark va a la izquierda (pedido explícito) y los enlaces a la comunidad
 * (Mana Games, Steam, XKT Mod, Tennis Elbow Hub) a la derecha, en una píldora blanca
 * para que se lean bien sea cual sea el color propio de cada logo. `"use client"`
 * porque este componente cuelga de `SiteNav`, que ya es Client Component — y porque
 * cada icono se comprueba con `useImageExists` (ver lib/) antes de pintarse: mientras
 * el propietario no añada los ficheros (ver lib/partnerLinks.ts), ese enlace
 * simplemente no sale, en vez de dejar un hueco roto.
 */
const SIZES = {
  compact: { band: "h-16", wordmark: "h-9" },
  hero: { band: "h-28 sm:h-40", wordmark: "h-14 sm:h-20" },
} as const;

function PartnerIcon({ href, label, logo }: { href: string; label: string; logo: string }) {
  const exists = useImageExists(logo);
  if (!exists) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-sm transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900 sm:h-16 sm:w-16"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- icono estático de terceros, no vale la pena el pipeline de next/image */}
      <img src={logo} alt="" className="h-9 w-9 object-contain sm:h-12 sm:w-12" />
    </a>
  );
}

export function BrandBar({ size = "compact" }: { size?: "compact" | "hero" }) {
  const s = SIZES[size];

  return (
    <div className="w-full bg-accent-500">
      <div className={`tour-container flex ${s.band} items-center justify-between gap-4`}>
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

        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          {PARTNER_LINKS.map((link) => (
            <PartnerIcon key={link.id} href={link.href} label={link.label} logo={link.logo} />
          ))}
        </div>
      </div>
    </div>
  );
}
