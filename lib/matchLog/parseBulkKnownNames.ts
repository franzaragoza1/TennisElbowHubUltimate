/**
 * Formato del textarea "Bulk add known names" en `/admin/players` —
 * `Name: pastname, pastname2; Name: pastname` — un jugador por bloque, separados
 * por `;`, y dentro de cada bloque el nombre real va antes de `:` y las variantes
 * separadas por `,`. Puro: no toca la base de datos, así que se puede testear sin
 * una BD viva (la resolución de "Name" contra `players` de verdad vive en
 * `app/admin/players/actions.ts::bulkAddKnownNames`).
 */
export interface BulkKnownNamesBlock {
  nameQuery: string;
  aliases: string[];
}

export interface ParsedBulkKnownNames {
  blocks: BulkKnownNamesBlock[];
  /** Bloques que no se pudieron leer (sin ":", o sin nombre, o sin ningún alias
   * después de quitar los vacíos) — se devuelven tal cual para enseñárselos al
   * admin, nunca se descartan en silencio. */
  malformed: string[];
}

export function parseBulkKnownNames(input: string): ParsedBulkKnownNames {
  const blocks: BulkKnownNamesBlock[] = [];
  const malformed: string[] = [];

  for (const rawBlock of input.split(";")) {
    const block = rawBlock.trim();
    if (!block) continue;

    const colonIdx = block.indexOf(":");
    if (colonIdx === -1) {
      malformed.push(block);
      continue;
    }

    const nameQuery = block.slice(0, colonIdx).trim();
    const aliases = block
      .slice(colonIdx + 1)
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    if (!nameQuery || aliases.length === 0) {
      malformed.push(block);
      continue;
    }

    blocks.push({ nameQuery, aliases });
  }

  return { blocks, malformed };
}
