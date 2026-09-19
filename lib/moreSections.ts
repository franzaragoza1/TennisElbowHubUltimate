/**
 * Única fuente de qué vive bajo "More" — usada tanto por el desplegable de la barra de
 * navegación (components/nav/SiteNav.tsx, pedido explícito: "should appear in a
 * dropdown menu when pointing on More") como por la propia página /more, para que
 * añadir una sección nueva no obligue a tocar dos listas por separado.
 */
export interface MoreSection {
  href: string;
  title: string;
  description: string;
}

// "Following" retirado a propósito (pedido explícito, 2026-09-18) — vuelve cuando se
// construyan las notificaciones (ver el plan de push notifications), no antes: sin
// avisos de verdad, un feed de actividad que hay que acordarse de comprobar solo no
// aporta lo suficiente por sí solo. app/following/page.tsx sigue existiendo tal cual,
// solo deja de estar enlazado desde aquí.
export const MORE_SECTIONS: MoreSection[] = [
  {
    href: "/predictions/rankings",
    title: "Predictor Rankings",
    description: "Who's calling brackets best — total points across every tournament predicted.",
  },
  {
    href: "/awards",
    title: "Awards",
    description: "Point of the Month and every other award, voted on by the community.",
  },
  {
    href: "/more/faq",
    title: "FAQ",
    description: "How the ranking works, how to claim your profile, and what the Discord bot does.",
  },
  {
    href: "/more/credits",
    title: "Credits",
    description: "Who built this, and where the tournaments, matches, and rankings actually come from.",
  },
];
