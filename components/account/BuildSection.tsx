"use client";

import { useState } from "react";
import type { UpdatePlayerBuildInput } from "@/app/account/actions";
import { BuildImageUpload } from "./BuildImageUpload";
import { PlayerBuildForm } from "./PlayerBuildForm";

/**
 * Coordina las dos piezas del "Build" en /account: el upload+recorte del screenshot
 * y el formulario de estadísticas — viven en dos componentes aparte, pero
 * `BuildImageUpload` necesita poder rellenar el formulario con lo que la IA leyó del
 * screenshot (`onExtracted`). Un Server Component (app/account/page.tsx) no puede
 * guardar ese estado compartido, de ahí este wrapper cliente.
 *
 * `key` en `PlayerBuildForm` fuerza que se reinicie con los valores nuevos cuando
 * llega una extracción: ese formulario solo lee su prop `build` UNA VEZ, al montar
 * (useState(build)) — sin el remount, los valores extraídos nunca sustituirían lo que
 * ya había en pantalla.
 */
export function BuildSection({
  initialBuild,
  currentImageUrl,
}: {
  initialBuild: UpdatePlayerBuildInput;
  currentImageUrl: string | null;
}) {
  const [extracted, setExtracted] = useState<Partial<UpdatePlayerBuildInput> | null>(null);

  return (
    <>
      <BuildImageUpload currentImageUrl={currentImageUrl} onExtracted={setExtracted} />
      <div className="mt-6">
        <PlayerBuildForm key={extracted ? "extracted" : "initial"} build={extracted ? { ...initialBuild, ...extracted } : initialBuild} />
      </div>
    </>
  );
}
