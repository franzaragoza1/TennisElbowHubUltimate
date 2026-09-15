"use client";

import { useState, useTransition, type RefObject } from "react";
import { enhanceNewsDraft } from "@/app/admin/news/actions";

/**
 * Compartido entre NewsForm.tsx (admin) y ReporterStoryForm.tsx (reportero aprobado)
 * — mismo botón "Enhance with AI" en los dos, misma extracción de texto plano desde
 * el HTML vivo del editor. Extraído en vez de duplicado porque no son "unas pocas
 * líneas parecidas": es una extracción de datos del form + una llamada async con su
 * propio manejo de error, y una copia ligeramente distinta de eso en cada sitio es
 * exactamente donde un bug se cuela en una copia y no en la otra.
 */
export function useEnhanceNewsDraft(formRef: RefObject<HTMLFormElement | null>, taggedPlayerIds: number[]) {
  const [isEnhancing, startEnhancing] = useTransition();
  const [enhanceError, setEnhanceError] = useState<string | null>(null);

  function runEnhance(onSuccess: (content: { excerpt: string; body: string }) => void) {
    setEnhanceError(null);
    const form = formRef.current;
    if (!form) return;

    const formData = new FormData(form);
    const title = String(formData.get("title") ?? "").trim();
    const category = String(formData.get("category") ?? "REPORT");
    const editionRaw = String(formData.get("editionId") ?? "");
    const editionId = editionRaw ? Number(editionRaw) : null;
    // Solo NewsForm.tsx (admin, editando uno ya existente) trae este campo —
    // ReporterStoryForm.tsx nunca edita, así que aquí siempre sale null para un
    // reportero, exactamente lo que hace falta: nunca hay un "yo mismo" que excluir.
    const idRaw = String(formData.get("id") ?? "");
    const newsId = idRaw ? Number(idRaw) : null;

    // El cuerpo vivo del editor es HTML (ver RichTextEditor.tsx) — a Groq solo le hace
    // falta la prosa, nunca el marcado, y el propio DOM ya sabe extraerla sin traer
    // ninguna librería aparte solo para esto.
    const container = document.createElement("div");
    container.innerHTML = String(formData.get("body") ?? "");
    const draftBody = (container.textContent ?? "").trim();

    startEnhancing(async () => {
      const result = await enhanceNewsDraft({ newsId, title, category, editionId, playerIds: taggedPlayerIds, draftBody });
      if (result.error) {
        setEnhanceError(result.error);
        return;
      }
      if (result.content) onSuccess(result.content);
    });
  }

  return { isEnhancing, enhanceError, runEnhance };
}
