"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { BrandBar } from "./BrandBar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SearchBar } from "./SearchBar";

const SECTIONS: { label: string; href: string | null }[] = [
  { label: "Scores", href: "/scores" },
  { label: "News", href: "/news" },
  { label: "H2H", href: "/h2h" },
  { label: "Stats", href: "/stats" },
  { label: "Rankings", href: "/rankings" },
  { label: "Players", href: "/players" },
  { label: "Tournaments", href: "/tournaments" },
  { label: "Finals", href: "/finals" },
  { label: "More", href: "/more" },
];

export function SiteNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  // El sistema de admin es independiente del de usuarios (Discord) — sigue
  // consultándose aparte, ver lib/adminSession.ts.
  const [isAdmin, setIsAdmin] = useState(false);
  // "The website will ask every user to upload match logs every now and then" —
  // ver lib/matchLog/uploadReminder.ts. Solo tiene sentido consultar esto con sesión
  // iniciada, así que se sondea cada vez que cambia `session`, no `pathname`.
  const [matchLogOverdue, setMatchLogOverdue] = useState(false);
  // Vive aquí, no dentro de SearchBar: la píldora de búsqueda crece en `absolute`
  // sobre estos mismos botones (tema, Admin Mode, sesión) en vez de empujarlos —
  // sin apagarlos mientras está abierta, se los tapaba en vez de crecer sobre el
  // hueco vacío que dejan.
  const [searchExpanded, setSearchExpanded] = useState(false);
  // Por debajo de `md` las 9 secciones no caben sin recortarse a media palabra
  // (capturas reales del móvil: "SCORES" tapado por el propio icono de tema) — en vez
  // de la fila horizontal con scroll (que sigue siendo la de escritorio, sin tocar),
  // el móvil recibe un desplegable propio con la sección activa como título del botón.
  const [sectionsMenuOpen, setSectionsMenuOpen] = useState(false);
  const sectionsMenuRef = useRef<HTMLDivElement>(null);

  const closeSectionsMenu = useCallback(() => setSectionsMenuOpen(false), []);

  useEffect(() => {
    // Cierra el desplegable al navegar (el propio Link ya lo hace en el click que lo
    // dispara, pero esto también cubre volver atrás con el navegador). No hay forma de
    // "sincronizar con un sistema externo" aquí sin más — es justo el caso que
    // `react-hooks/set-state-in-effect` señala como innecesario en general, pero
    // "cerrar un desplegable al cambiar de ruta" no tiene alternativa sin efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSectionsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sectionsMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSectionsMenu();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (sectionsMenuRef.current && !sectionsMenuRef.current.contains(e.target as Node)) closeSectionsMenu();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [sectionsMenuOpen, closeSectionsMenu]);

  const activeSection = SECTIONS.find((section) => section.href !== null && pathname.startsWith(section.href));

  useEffect(() => {
    fetch("/api/admin-session")
      .then((res) => res.json())
      .then((data) => setIsAdmin(Boolean(data?.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, [pathname]);

  useEffect(() => {
    // La ruta ya devuelve overdue:false sin sesión, así que no hace falta ramificar
    // aquí — igual que la de isAdmin arriba.
    fetch("/api/account/match-log/reminder")
      .then((res) => res.json())
      .then((data) => setMatchLogOverdue(Boolean(data?.overdue)))
      .catch(() => setMatchLogOverdue(false));
  }, [session]);

  return (
    <header className="w-full">
      {/* Misma banda hero en todas las páginas (pedido explícito) — antes la home iba a
       * tamaño hero y el resto a compacto, y el salto de altura entre páginas era
       * incómodo al navegar. */}
      <BrandBar size="hero" />
      <div className="bg-navy-900 w-full">
      <div className="tour-container flex h-14 items-center justify-between gap-4">
        <nav className="nav-scroll hidden flex-1 items-center gap-5 overflow-x-auto md:flex md:gap-6">
          {SECTIONS.map((section) => {
            const isActive = section.href !== null && pathname.startsWith(section.href);
            if (!section.href) {
              return (
                <span
                  key={section.label}
                  className="text-eyebrow flex shrink-0 cursor-default items-center border-b-2 border-transparent py-2 text-xs text-white/40"
                >
                  {section.label}
                </span>
              );
            }
            return (
              <Link
                key={section.label}
                href={section.href}
                className={`text-eyebrow flex shrink-0 items-center py-2 text-xs transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-500 ${
                  isActive
                    ? "border-b-2 border-accent-500 text-white"
                    : "border-b-2 border-transparent text-white/70 hover:text-white"
                }`}
              >
                {section.label}
              </Link>
            );
          })}
        </nav>

        <div
          ref={sectionsMenuRef}
          className={`relative flex-1 transition-opacity duration-200 md:hidden ${
            searchExpanded ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          {/* Igual que el grupo de tema/sesión de la derecha: al abrir la búsqueda esto
           * se apaga en vez de seguir mostrándose debajo — la píldora de búsqueda crece
           * en `absolute` (ver SearchBar.tsx) y en móvil, sin el hueco ancho de
           * escritorio de sobra, tapaba a medias este botón en vez de crecer sobre
           * espacio vacío (bug real reportado, "el la sección se desordena"). Sigue
           * ocupando su ancho en el layout (`opacity`, no `hidden`) para que la píldora
           * no empuje nada al aparecer. */}
          <button
            type="button"
            onClick={() => {
              setSearchExpanded(false);
              setSectionsMenuOpen((open) => !open);
            }}
            aria-expanded={sectionsMenuOpen}
            aria-label="Sections menu"
            tabIndex={searchExpanded ? -1 : 0}
            className="text-eyebrow -ml-2 flex items-center gap-1.5 rounded-md px-2 py-2 text-xs text-white transition-colors duration-150 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <line x1="3" y1="5" x2="17" y2="5" />
              <line x1="3" y1="10" x2="17" y2="10" />
              <line x1="3" y1="15" x2="17" y2="15" />
            </svg>
            {activeSection?.label ?? "Menu"}
          </button>

          {sectionsMenuOpen && !searchExpanded && (
            <div className="animate-in fade-in slide-in-from-top-2 border-rule/20 absolute top-full left-0 z-50 mt-2 w-48 overflow-hidden rounded-lg border bg-navy-800 py-1 shadow-xl duration-200">
              {SECTIONS.map((section) => {
                const isActive = section.href !== null && pathname.startsWith(section.href);
                if (!section.href) {
                  return (
                    <span key={section.label} className="text-eyebrow flex cursor-default items-center border-l-2 border-transparent px-4 py-2.5 text-xs text-white/40">
                      {section.label}
                    </span>
                  );
                }
                return (
                  <Link
                    key={section.label}
                    href={section.href}
                    onClick={closeSectionsMenu}
                    className={`text-eyebrow flex items-center border-l-2 px-4 py-2.5 text-xs transition-colors duration-150 ${
                      isActive ? "border-accent-500 bg-white/10 text-white" : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {section.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div
            className={`flex items-center gap-3 transition-opacity duration-200 ${
              searchExpanded ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
          >
            <ThemeToggle />
            {matchLogOverdue && (
              <Link
                href="/account"
                className="text-eyebrow flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" aria-hidden="true" />
                Upload MatchLog
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/admin"
                className="text-eyebrow flex items-center gap-1.5 rounded-full border border-accent-500/40 bg-accent-500/10 px-3 py-1.5 text-xs text-accent-500 hover:bg-accent-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" aria-hidden="true" />
                Admin Mode
              </Link>
            )}
          </div>

          <SearchBar
            expanded={searchExpanded}
            onExpandedChange={(expanded) => {
              setSearchExpanded(expanded);
              if (expanded) closeSectionsMenu();
            }}
          />

          {/* En escritorio esto se apaga con opacidad (sigue reservando su ancho, la
           * píldora de búsqueda crece sobre ese hueco vacío — ver el comentario de
           * SearchBar.tsx). En móvil hace falta quitarlo del todo del flujo (`hidden`,
           * no solo invisible): esta caja vive DESPUÉS del ancla de búsqueda en el DOM
           * (a su derecha), así que su ancho reservado (más ancho con sesión iniciada —
           * avatar + nombre + "Log out" — que el simple botón "Sign in") empujaba el
           * ancla hacia la izquierda del borde real de la pantalla, y la píldora, que
           * cuelga de ESE ancla, se desplazaba con ella — bug real reportado, "still
           * moves out, but only when logged in". Sin sitio de sobra como en escritorio,
           * la única forma de que el ancla llegue de verdad al borde es que esto deje
           * de ocupar espacio. */}
          <div
            className={`items-center gap-3 transition-opacity duration-200 ${
              searchExpanded ? "hidden opacity-0 pointer-events-none sm:flex" : "flex opacity-100"
            }`}
          >
            {session?.user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/account"
                  className="flex items-center gap-2 text-eyebrow text-xs text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
                >
                  {session.user.image && (
                    <Image
                      src={session.user.image}
                      alt=""
                      width={22}
                      height={22}
                      className="h-[22px] w-[22px] shrink-0 rounded-full"
                      unoptimized
                    />
                  )}
                  {session.user.name}
                </Link>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="text-eyebrow text-xs text-white/40 hover:text-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
                >
                  Log out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => signIn("discord")}
                className="text-eyebrow rounded-full bg-white/10 px-4 py-1.5 text-xs text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>
      </div>
    </header>
  );
}
