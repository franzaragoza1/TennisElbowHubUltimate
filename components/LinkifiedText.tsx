import { Fragment } from "react";
import { splitLinkifiable } from "@/lib/linkify";

/** Envuelve un trozo de texto plano, convirtiendo cualquier URL suelta en un enlace de
 * verdad — ver lib/linkify.ts para el porqué (texto plano de noticias, nunca
 * markdown). Server Component: no hace falta interactividad, solo `<a>` normales. */
export function LinkifiedText({ text }: { text: string }) {
  const segments = splitLinkifiable(text);
  return (
    <>
      {segments.map((seg, i) =>
        seg.href ? (
          <a key={i} href={seg.href} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
            {seg.text}
          </a>
        ) : (
          <Fragment key={i}>{seg.text}</Fragment>
        ),
      )}
    </>
  );
}
