"use client";

import Link from "next/link";
import Image from "next/image";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { User } from "lucide-react";
import { BrandBar } from "./BrandBar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { SearchBar } from "./SearchBar";
import { MORE_SECTIONS } from "@/lib/moreSections";

const SECTIONS: { label: string; href: string | null }[] = [
  { label: "Scores", href: "/scores" },
  { label: "Latest", href: "/news" },
  { label: "H2H", href: "/h2h" },
  { label: "Stats", href: "/stats" },
  { label: "Rankings", href: "/rankings" },
  { label: "Players", href: "/players" },
  { label: "Tournaments", href: "/tournaments" },
  { label: "Discussions", href: "/discussions" },
  { label: "More", href: "/more" },
];

export function SiteNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  // Vive aquí, no dentro de SearchBar: la píldora de búsqueda crece en `absolute`
  // sobre estos mismos botones (tema, sesión) en vez de empujarlos — sin apagarlos
  // mientras está abierta, se los tapaba en vez de crecer sobre el hueco vacío que
  // dejan.
  const [searchExpanded, setSearchExpanded] = useState(false);
  // Por debajo de `md` las 9 secciones no caben sin recortarse a media palabra
  // (capturas reales del móvil: "SCORES" tapado por el propio icono de tema) — en vez
  // de la fila horizontal con scroll (que sigue siendo la de escritorio, sin tocar),
  // el móvil recibe un desplegable propio con la sección activa como título del botón.
  const [sectionsMenuOpen, setSectionsMenuOpen] = useState(false);
  const sectionsMenuRef = useRef<HTMLDivElement>(null);

  const closeSectionsMenu = useCallback(() => setSectionsMenuOpen(false), []);

  // Desplegable de cuenta EN MÓVIL (pedido explícito, 2026-09-19, para el bug real de
  // desbordamiento horizontal ya arreglado en la fila de sesión: en vez de solo
  // acotar cada pieza por separado, sacarlas todas de la fila fija reduce de raíz
  // cuánto compite por hueco ahí). Agrupa la campana de notificaciones y sesión/
  // "Log out" (o "Sign in") detrás de un único icono — búsqueda y tema se quedan
  // fuera a propósito, pedido explícito. Mismo patrón que `sectionsMenuOpen` de
  // arriba (cierre al navegar, clic fuera, Escape), sin necesidad de portal: a
  // diferencia de "More", este vive fuera del `<nav>` con `overflow-x-auto`.
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const closeAccountMenu = useCallback(() => setAccountMenuOpen(false), []);

  // El desplegable de "More" (pedido explícito, 2026-09-18) NO puede ser un simple
  // `absolute` colgando de su propio trigger: ese trigger vive dentro del `<nav>` de
  // arriba, que lleva `overflow-x-auto` para el scroll horizontal en desktops
  // estrechos — cualquier hijo `absolute` que se salga hacia abajo se recorta ahí
  // mismo (bug real encontrado al verificar con Playwright: el panel nunca llegaba a
  // pintarse). Portal a `document.body` + posición medida con `getBoundingClientRect`
  // en vez de CSS `absolute` esquiva ese recorte del todo, sin tocar el overflow real
  // que sí hace falta para el scroll.
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTriggerRef = useRef<HTMLDivElement>(null);
  const [morePos, setMorePos] = useState<{ top: number; left: number } | null>(null);

  const openMore = useCallback(() => {
    const rect = moreTriggerRef.current?.getBoundingClientRect();
    if (rect) setMorePos({ top: rect.bottom, left: rect.left + rect.width / 2 });
    setMoreOpen(true);
  }, []);
  const closeMore = useCallback(() => setMoreOpen(false), []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMoreOpen(false);
  }, [pathname]);

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccountMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAccountMenu();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) closeAccountMenu();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [accountMenuOpen, closeAccountMenu]);

  const activeSection = SECTIONS.find((section) => section.href !== null && pathname.startsWith(section.href));

  return (
    <>
    <header className="w-full">
      {/* Misma banda hero en todas las páginas (pedido explícito) — antes la home iba a
       * tamaño hero y el resto a compacto, y el salto de altura entre páginas era
       * incómodo al navegar. */}
      <BrandBar size="hero" />
      <div className="bg-navy-900 w-full">
      <div className="tour-container flex h-14 items-center justify-between gap-4">
        {/* `opacity-0` con la búsqueda abierta, mismo criterio que el resto de vecinos
         * de esta fila (tema, sesión, más abajo) — la píldora crece en `absolute` desde
         * el ancla de la derecha y, en escritorio, se solapaba con los últimos enlaces
         * de la nav en vez de crecer sobre hueco vacío (bug real: "Discussions" es más
         * larga que "Awards", lo que sustituyó, y dejó de caber el hueco que antes
         * bastaba de casualidad). Apagar la nav entera mientras se busca es más simple
         * y más robusto que reservar un hueco fijo para el ancho máximo de la píldora
         * (`sm:w-72`), que además cambiaría según la ventana. */}
        <nav
          className={`nav-scroll hidden flex-1 items-center gap-5 overflow-x-auto transition-opacity duration-200 md:flex md:gap-6 ${
            searchExpanded ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
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
            if (section.label === "More") {
              // Desplegable al pasar el ratón (pedido explícito, 2026-09-18: "other
              // pages from the More section should appear in a dropdown menu when
              // pointing on More"). El panel en sí vive en un portal más abajo (ver el
              // comentario junto a `moreOpen`) — aquí solo el disparador, con
              // mouseenter/leave y focus/blur (React sí burbujea focus/blur de
              // descendientes hasta este contenedor) para que tabular hasta el enlace
              // "More" o hasta cualquier fila del panel lo mantenga abierto igual que
              // el ratón.
              const moreActive = isActive || MORE_SECTIONS.some((s) => pathname.startsWith(s.href));
              return (
                <div
                  key={section.label}
                  ref={moreTriggerRef}
                  className="relative shrink-0"
                  onMouseEnter={openMore}
                  onMouseLeave={closeMore}
                  onFocus={openMore}
                  onBlur={closeMore}
                >
                  <Link
                    href={section.href}
                    className={`text-eyebrow flex items-center gap-1 py-2 text-xs transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-500 ${
                      moreActive
                        ? "border-b-2 border-accent-500 text-white"
                        : "border-b-2 border-transparent text-white/70 hover:text-white"
                    }`}
                  >
                    {section.label}
                    <svg aria-hidden="true" viewBox="0 0 20 20" width="10" height="10" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="5 7.5 10 12.5 15 7.5" />
                    </svg>
                  </Link>
                </div>
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
            aria-label={`${activeSection?.label ?? "Menu"} - open the sections menu`}
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
            {/* La campana se muda al desplegable de cuenta en móvil, aquí solo queda
             * para `sm:` en adelante — ver `accountMenuOpen` más abajo. */}
            <div className="hidden sm:block">
              <NotificationBell />
            </div>
            <ThemeToggle />
          </div>

          <SearchBar
            expanded={searchExpanded}
            onExpandedChange={(expanded) => {
              setSearchExpanded(expanded);
              if (expanded) closeSectionsMenu();
            }}
          />

          {/* Solo `sm:` en adelante (pedido explícito, 2026-09-19) — en móvil esta
           * misma sesión/"Log out" vive detrás del icono de cuenta de más abajo
           * (`accountMenuOpen`), no aquí; era justo esta fila, sin ningún límite de
           * ancho, la que forzaba la cabecera entera más ancha que la pantalla (bug
           * real reportado, ver el `truncate` que sigue puesto por si acaso). En
           * escritorio sigue apagándose con opacidad, no `hidden`, mientras la
           * búsqueda está abierta — sigue reservando su ancho, la píldora de búsqueda
           * crece sobre ese hueco vacío (ver el comentario de SearchBar.tsx). */}
          <div
            className={`hidden items-center gap-3 transition-opacity duration-200 sm:flex ${
              searchExpanded ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
          >
            {session?.user ? (
              // `min-w-0` + `truncate` en el nombre — sin esto, un display name largo
              // de Discord no tiene ningún límite y fuerza a toda esta fila (y, con
              // ella, la cabecera entera) más ancha que el propio contenido flexible
              // permitiría, en vez de recortarse con puntos suspensivos (bug real
              // reportado en móvil, 2026-09-19). `shrink-0` en "Log out" a propósito:
              // entre los dos, el nombre es el que puede variar de verdad en longitud,
              // así que es el que debe ceder primero.
              <div className="flex min-w-0 items-center gap-2">
                <Link
                  href="/account"
                  className="flex min-w-0 items-center gap-2 text-eyebrow text-xs text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
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
                  <span className="max-w-24 truncate sm:max-w-none">{session.user.name}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="text-eyebrow shrink-0 text-xs text-white/40 hover:text-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
                >
                  Log out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => signIn("discord", { callbackUrl: "/account" })}
                className="text-eyebrow rounded-full bg-white/10 px-4 py-1.5 text-xs text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
              >
                Sign in
              </button>
            )}
          </div>

          {/* Solo por debajo de `sm` — un único icono en vez de campana + avatar/nombre/
           * "Log out" (o "Sign in") sueltos, pedido explícito, 2026-09-19: menos piezas
           * compitiendo por hueco en la fila fija de la cabecera en móvil, la causa de
           * raíz del desbordamiento horizontal ya visto ahí. Búsqueda y tema se quedan
           * fuera del desplegable a propósito, mismo pedido. */}
          <div
            ref={accountMenuRef}
            className={`relative sm:hidden transition-opacity duration-200 ${
              searchExpanded ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
          >
            <button
              type="button"
              onClick={() => setAccountMenuOpen((open) => !open)}
              aria-label="Account menu"
              aria-expanded={accountMenuOpen}
              tabIndex={searchExpanded ? -1 : 0}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
            >
              {session?.user?.image ? (
                <Image src={session.user.image} alt="" width={26} height={26} className="h-[26px] w-[26px] rounded-full" unoptimized />
              ) : (
                <User size={18} aria-hidden="true" />
              )}
            </button>

            {accountMenuOpen && (
              <div className="animate-in fade-in slide-in-from-top-2 border-rule/20 absolute top-full right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border bg-navy-800 py-1 shadow-xl duration-200">
                {session?.user ? (
                  <>
                    <Link
                      href="/account"
                      onClick={closeAccountMenu}
                      className="flex items-center gap-2 px-4 py-2.5 text-xs text-white/80 hover:bg-white/5 hover:text-white"
                    >
                      {session.user.image && (
                        <Image src={session.user.image} alt="" width={20} height={20} className="h-5 w-5 shrink-0 rounded-full" unoptimized />
                      )}
                      <span className="truncate">{session.user.name}</span>
                    </Link>
                    {/* La propia campana, no un enlace aparte — sigue gestionando su
                     * sondeo, su aviso y su lista tal cual (su desplegable ya usa
                     * `fixed` en móvil, así que no se recorta dentro de este panel).
                     * Envuelta en una fila con etiqueta para que no sea un icono suelto
                     * sin contexto entre dos filas de texto. */}
                    <div className="flex items-center justify-between border-t border-white/10 px-4 py-1.5 text-xs text-white/80">
                      <span>Notifications</span>
                      <NotificationBell />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        closeAccountMenu();
                        signOut();
                      }}
                      className="text-eyebrow block w-full border-t border-white/10 px-4 py-2.5 text-left text-xs text-white/50 hover:bg-white/5 hover:text-white"
                    >
                      Log out
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      closeAccountMenu();
                      signIn("discord", { callbackUrl: "/account" });
                    }}
                    className="text-eyebrow block w-full px-4 py-2.5 text-left text-xs text-white hover:bg-white/5"
                  >
                    Sign in
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </header>
    {moreOpen &&
      morePos &&
      typeof document !== "undefined" &&
      createPortal(
        <div
          role="menu"
          onMouseEnter={openMore}
          onMouseLeave={closeMore}
          onFocus={openMore}
          onBlur={closeMore}
          className="animate-in fade-in slide-in-from-top-2 border-rule/20 fixed z-50 w-56 -translate-x-1/2 overflow-hidden rounded-lg border bg-navy-800 py-1 shadow-xl duration-200"
          style={{ top: morePos.top, left: morePos.left }}
        >
          {MORE_SECTIONS.map((sub) => {
            const subActive = pathname.startsWith(sub.href);
            return (
              <Link
                key={sub.href}
                href={sub.href}
                role="menuitem"
                className={`text-eyebrow block px-4 py-2.5 text-xs transition-colors duration-150 ${
                  subActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                {sub.title}
              </Link>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
