"use client";

import { useState } from "react";

export interface AccountSection {
  id: string;
  label: string;
  content: React.ReactNode;
  /** Marca el inicio de un grupo nuevo en la lista de la izquierda — se pinta como una
   * etiqueta de texto encima de este item, sin volverse un nivel propio de navegación
   * (pedido explícito: separar Admin del resto "just with a text", no anidando otra
   * vez un segundo nivel tipo AccountShell dentro de AccountShell). */
  groupLabel?: string;
  /** Pedido explícito: "small icons to the left of the sections". YA renderizado
   * (`<User className="..." />`), nunca la referencia al componente en sí — este
   * fichero es "use client" y app/account/page.tsx es un Server Component, y React
   * Server Components solo puede pasar elementos ya construidos por ese límite, nunca
   * una referencia a función/componente en crudo ("Only plain objects can be passed
   * to Client Components", bug real reportado al pasar el componente `LucideIcon` en
   * vez de `<LucideIcon />`). */
  icon?: React.ReactNode;
}

/**
 * Navegación por secciones a la izquierda para /account — pedido explícito: la
 * página iba acumulando una tarjeta detrás de otra (foto, perfil, Build, MatchLog...)
 * hasta hacerse demasiado larga para desplazarse por ella. Cambio de sección en el
 * cliente, sin ruta propia por sección — todos los datos ya llegaron del servidor de
 * una vez (app/account/page.tsx), así que no hace falta un viaje de vuelta al
 * servidor solo para cambiar qué tarjeta se ve.
 */
export function AccountShell({ sections }: { sections: AccountSection[] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const active = sections.find((s) => s.id === activeId) ?? sections[0];

  return (
    <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
      <nav className="nav-scroll flex shrink-0 gap-1 overflow-x-auto pb-1 sm:w-44 sm:flex-col sm:overflow-visible sm:pb-0">
        {sections.map((s, i) => (
          <div key={s.id} className="contents">
            {s.groupLabel && (
              <span className={`text-eyebrow shrink-0 px-3 pb-1 text-[10px] text-muted-label/70 ${i === 0 ? "" : "mt-8"}`}>
                {s.groupLabel}
              </span>
            )}
            <button
              type="button"
              onClick={() => setActiveId(s.id)}
              className={`text-eyebrow flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-xs whitespace-nowrap transition-colors ${
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
