"use client";

import { useState } from "react";

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

function SidebarShell({ sections, activeId, setActiveId }: { sections: ShellSection[]; activeId: string; setActiveId: (id: string) => void }) {
  const active = sections.find((s) => s.id === activeId) ?? sections[0];

  return (
    <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
      <nav className="nav-scroll flex shrink-0 gap-1 overflow-x-auto pb-1 sm:w-44 sm:flex-col sm:overflow-visible sm:pb-0">
        {sections.map((s, i) => (
          <div key={s.id} className="contents">
            {s.groupLabel && (
              // `mt-8` solo separa algo cuando la nav es una columna (`sm:flex-col`) —
              // en la fila horizontal de móvil un margen vertical no hace nada visible
              // (bug real: la etiqueta "Admin" quedaba descentrada dentro de la fila),
              // así que ahí se sustituye por un separador vertical + centrado.
              <span
                className={`text-eyebrow shrink-0 self-center px-3 pb-1 text-[10px] text-muted-label/70 sm:self-auto ${
                  i === 0 ? "" : "border-l border-rule pl-3 sm:mt-8 sm:border-l-0 sm:pl-3"
                }`}
              >
                {s.groupLabel}
              </span>
            )}
            <button
              type="button"
              onClick={() => setActiveId(s.id)}
              className={`text-eyebrow flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-left text-xs whitespace-nowrap transition-colors ${
                s.id === active?.id ? "bg-navy-900 text-white" : "text-muted-label hover:bg-paper-tint hover:text-ink"
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          </div>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{active?.content}</div>
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
      <nav className="mb-3 flex overflow-x-auto rounded-lg bg-navy-900">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveId(s.id)}
            className={`text-eyebrow shrink-0 border-b-2 px-4 py-2 text-xs whitespace-nowrap transition-colors ${
              s.id === active?.id ? "border-accent-500 text-white" : "border-transparent text-white/60 hover:text-white"
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>
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
export function SectionShell({ sections, variant = "sidebar" }: { sections: ShellSection[]; variant?: "sidebar" | "tabs" }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");

  return variant === "tabs" ? (
    <TabsShell sections={sections} activeId={activeId} setActiveId={setActiveId} />
  ) : (
    <SidebarShell sections={sections} activeId={activeId} setActiveId={setActiveId} />
  );
}
