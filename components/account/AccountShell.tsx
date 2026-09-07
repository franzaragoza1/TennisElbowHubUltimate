"use client";

import { useState } from "react";

export interface AccountSection {
  id: string;
  label: string;
  content: React.ReactNode;
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
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveId(s.id)}
            className={`text-eyebrow shrink-0 rounded-md px-3 py-2 text-left text-xs whitespace-nowrap transition-colors ${
              s.id === active?.id ? "bg-navy-900 text-white" : "text-muted-label hover:bg-paper-tint hover:text-ink"
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{active?.content}</div>
    </div>
  );
}
