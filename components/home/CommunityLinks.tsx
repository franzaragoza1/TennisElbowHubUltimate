"use client";

import { PARTNER_LINKS } from "@/lib/partnerLinks";
import { useImageExists } from "@/lib/useImageExists";

/** `"use client"` para poder comprobar con `useImageExists` (ver lib/) si el logo ya
 * existe antes de pintarlo — mientras el propietario no lo añada (ver
 * lib/partnerLinks.ts), el enlace sale con un icono neutro en vez de una imagen rota. */
function ExternalLinkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M8 5H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 4h4v4M16 4l-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CommunityLinkTile({ href, label, logo }: { href: string; label: string; logo: string }) {
  const exists = useImageExists(logo);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-rule bg-paper p-4 transition hover:border-blue-500 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    >
      {exists ? (
        // eslint-disable-next-line @next/next/no-img-element -- icono estático de terceros, no vale la pena el pipeline de next/image
        <img src={logo} alt="" className="h-10 w-10 shrink-0 rounded-full object-contain" />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper-tint text-muted-label">
          <ExternalLinkIcon />
        </span>
      )}
      <span className="text-headline min-w-0 truncate text-sm text-ink">{label}</span>
    </a>
  );
}

export function CommunityLinks() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {PARTNER_LINKS.map((link) => (
        <CommunityLinkTile key={link.id} href={link.href} label={link.label} logo={link.logo} />
      ))}
    </div>
  );
}
