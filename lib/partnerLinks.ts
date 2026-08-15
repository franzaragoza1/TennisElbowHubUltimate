export interface PartnerLink {
  id: string;
  label: string;
  href: string;
  /** Ruta bajo /public. El fichero todavía no existe en el repo — el propietario lo va
   * a añadir él mismo (igual que con los escudos de torneo en XKTTBSTD/). Sin
   * comprobación de existencia en tiempo real a propósito: `node:fs` no se puede
   * importar desde aquí sin romper el bundle de cliente (este módulo lo consume
   * `BrandBar`, que cuelga de `SiteNav`, un Client Component) — mismo criterio que
   * `lib/tournamentLogos.ts`, una tabla de confianza, no una comprobación en vivo. */
  logo: string;
}

export const PARTNER_LINKS: PartnerLink[] = [
  {
    id: "mana-forum",
    label: "Mana Games Forum",
    href: "https://www.managames.com/Forum/",
    logo: "/assets/partners/mana-forum.png",
  },

  {
    id: "xkt-mod",
    label: "XKT Mod",
    href: "https://mod.io/g/tennis-elbow-4/",
    logo: "/assets/partners/xkt-mod.png",
  },
  {
    id: "steam",
    label: "Steam",
    href: "https://store.steampowered.com/app/760640/Tennis_Elbow_4/",
    logo: "/assets/partners/steam.png",
  },
  {
    id: "tennis-elbow-hub",
    label: "Tennis Elbow Hub",
    href: "https://tenniselbowhub.live/live",
    logo: "/assets/partners/tennis-elbow-hub.png",
  },
  {
    id: "discord",
    label: "TE4 Tour Discord",
    href: "https://discord.gg/U5fB8eqmbZ",
    logo: "/assets/partners/discord.png",
  },
];
