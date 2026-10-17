"use client";

import { useSyncExternalStore } from "react";

/** `replaceState` no dispara `hashchange`: este evento propio avisa al store. */
const HASH_EVENT = "section-shell-hash";

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener(HASH_EVENT, onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener(HASH_EVENT, onChange);
  };
}

function readHash(): string {
  return decodeURIComponent(window.location.hash.slice(1));
}

export interface ShellSection {
  id: string;
  label: string;
  content: React.ReactNode;
  /** Marca el inicio de un grupo nuevo en la lista de la izquierda — se pinta como una
   * etiqueta de texto encima de este item, sin volverse un nivel propio de navegación
   * (pedido explícito: separar Admin del resto "just with a text", no anidando otra
   * vez un segundo nivel tipo SectionShell dentro de SectionShell). */
  groupLabel?: string;
  /** Pedido explícito: "small icons to the left of the sections". YA renderizado
   * (`<User className="..." />`), nunca la referencia al componente en sí — este
   * fichero es "use client" y quien lo llama (app/account/page.tsx, app/players/[id]/
   * page.tsx) es un Server Component, y React Server Components solo puede pasar
   * elementos ya construidos por ese límite, nunca una referencia a función/componente
   * en crudo ("Only plain objects can be passed to Client Components", bug real
   * reportado al pasar el componente `LucideIcon` en vez de `<LucideIcon />`). */
  icon?: React.ReactNode;
}

function SidebarShell({
  sections,
  activeId,
  setActiveId,
  header,
}: {
  sections: ShellSection[];
  activeId: string;
  setActiveId: (id: string) => void;
  header?: React.ReactNode;
}) {
  const active = sections.find((s) => s.id === activeId) ?? sections[0];

  // Rediseño de /account (2026-10-11): menú de 220 px con las etiquetas enteras (antes
  // 176 px y cortadas: "POINT OF THE MONT…"), activa marcada con un filete lima a la
  // izquierda sobre `bg-paper` en vez del bloque navy, título de la sección encima del
  // contenido para saber dónde se está. En móvil sigue siendo una fila de píldoras con
  // scroll horizontal.
  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-10">
      <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6">
        {header}
        <nav aria-label="Account sections" className="nav-scroll -mx-1 flex nav-scroll--column-lg gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
          {sections.map((s, i) => {
            const selected = s.id === active?.id;
            return (
              <div key={s.id} className="contents">
                {s.groupLabel && (
                  <span
                    className={`text-eyebrow shrink-0 self-center px-3 text-[10px] text-muted-label lg:self-auto lg:pb-1 ${
                      i === 0 ? "hidden lg:block" : "border-l border-rule pl-3 lg:mt-6 lg:border-l-0"
                    }`}
                  >
                    {s.groupLabel}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  aria-current={selected ? "page" : undefined}
                  className={`text-eyebrow flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-xs whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 lg:border-l-2 lg:whitespace-normal ${
                    selected
                      ? "bg-paper text-ink shadow-sm ring-1 ring-rule lg:rounded-l-none lg:border-accent-500"
                      : "text-muted-label hover:bg-paper hover:text-ink lg:border-transparent"
                  }`}
                >
                  {s.icon}
                  {s.label}
                </button>
              </div>
            );
          })}
        </nav>
      </div>
      <div className="min-w-0">
        <h2 className="text-headline mb-6 text-2xl text-ink">{active?.label}</h2>
        {active?.content}
      </div>
    </div>
  );
}

/**
 * Barra de pestañas horizontal — pedido explícito, con una captura de referencia de
 * una fila "Overview / Bio / Activity / Stats / Ranking" en color sólido con la activa
 * recortada en blanco. `navy-900`, no el azul de la captura — pedido explícito aparte,
 * "match the website colors": es el mismo tono que ya lleva la barra de navegación y
 * las cabeceras de todo el sitio. Ancho natural de cada pestaña (no a partes iguales)
 * — las etiquetas no miden lo mismo y forzarlas a `flex-1` habría dejado huecos raros
 * en las cortas.
 *
 * La activa se marca con un subrayado sobre el mismo fondo navy en vez del recorte
 * blanco de la captura original — pedido explícito tras verlo en la propia página:
 * "it looks also too much white when on light mode" (el bloque blanco se confundía
 * con el contenido claro justo debajo en modo claro). El subrayado es azul
 * (`blue-500`), no el lima de SiteNav — pedido explícito aparte, "match the colors of
 * palmares and awards": es el mismo azul que ya llevan los enlaces de esas dos tablas
 * justo debajo (títulos de Palmares, periodos de Awards), así que la pestaña activa
 * queda del mismo color que lo que hay que mirar dentro, en vez de un lima suelto que
 * no aparece en ningún otro sitio de esta ficha. Sin `nav-scroll` — esa clase trae un
 * degradado fijo en el borde derecho pensado como pista de "hay más" en una lista que
 * de verdad se desborda (pedido explícito: "remove that shade"); esta barra es corta y
 * no lo necesita. `mb-3`, no `mb-6` — pedido explícito, "bring the text closer to the
 * actual tabs": el contenido de cada pestaña quedaba con un hueco de sobra encima.
 */
function TabsShell({ sections, activeId, setActiveId }: { sections: ShellSection[]; activeId: string; setActiveId: (id: string) => void }) {
  const active = sections.find((s) => s.id === activeId) ?? sections[0];

  return (
    <div>
      {/* Pase visual (2026-10-11): pestañas subrayadas sobre la propia página, con
       * una línea de base `border-rule`, en vez del bloque navy relleno — mismo
       * lenguaje que el menú principal (SiteNav: texto + subrayado lima). Al ser
       * transparente no vuelve el problema del "too much white" en modo claro.
       * `role="tablist"`/`aria-selected` para lectores de pantalla. */}
      <div role="tablist" className="scrollbar-hidden mb-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-rule">
        {sections.map((s) => {
          const selected = s.id === active?.id;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveId(s.id)}
              className={`text-eyebrow -mb-px shrink-0 border-b-2 px-4 py-3 text-xs whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 ${
                selected ? "border-accent-500 text-ink" : "border-transparent text-muted-label hover:border-rule hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      <div className="min-w-0">{active?.content}</div>
    </div>
  );
}

/**
 * Navegación por secciones — antes vivía solo en /account (AccountShell), pedido
 * explícito: la ficha pública de jugador tenía el mismo problema ("Tour profile page
 * is too long, divide it in apposite sections") y no tenía sentido reinventar la misma
 * navegación aparte. Cambio de sección en el cliente, sin ruta propia por sección —
 * todos los datos ya llegaron del servidor de una vez, así que no hace falta un viaje
 * de vuelta al servidor solo para cambiar qué tarjeta se ve.
 *
 * Dos presentaciones sobre los mismos `sections`, pedido explícito ("would rather have
 * the section selection look like this than like in account"): `"sidebar"` (columna a
 * la izquierda, con iconos y grupos — /account, con su Admin de verdad separado del
 * resto) y `"tabs"` (barra horizontal rellena, sin iconos ni grupos — la ficha pública
 * de jugador). `activeId` vive aquí, no en cada variante, para que cambiar de
 * `variant` en caliente (no pasa hoy, pero por si acaso) no perdiera la pestaña activa.
 */
export function SectionShell({
  sections,
  variant = "sidebar",
  header,
}: {
  sections: ShellSection[];
  variant?: "sidebar" | "tabs";
  /** Solo se usa en `variant="sidebar"` — una tarjeta de identidad (avatar, nombre,
   * estadísticas sociales) pintada encima de la lista de secciones, pedido explícito
   * del propietario: "the Account section doesn't feel personal, looks more like
   * settings" (2026-09-18). `variant="tabs"` (la ficha pública de jugador) la ignora —
   * ahí la cabecera de la propia página ya cumple ese papel. */
  header?: React.ReactNode;
}) {
  // La sección activa vive en el `#` de la URL (2026-10-11): recargar o volver atrás
  // deja al usuario donde estaba, y se puede enlazar directo (/account#build). En el
  // servidor (y antes de hidratar) no hay hash: la primera sección.
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const activeId = sections.some((s) => s.id === hash) ? hash : (sections[0]?.id ?? "");

  function setActiveId(id: string) {
    try {
      window.history.replaceState(null, "", `#${encodeURIComponent(id)}`);
    } catch {
      // sin history (vista previa embebida): no se puede recordar
    }
    window.dispatchEvent(new Event(HASH_EVENT));
  }

  return variant === "tabs" ? (
    <TabsShell sections={sections} activeId={activeId} setActiveId={setActiveId} />
  ) : (
    <SidebarShell sections={sections} activeId={activeId} setActiveId={setActiveId} header={header} />
  );
}
