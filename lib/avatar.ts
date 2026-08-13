import { createAvatar } from "@dicebear/core";
import * as notionists from "@dicebear/notionists";
import type { Options as NotionistsOptions } from "@dicebear/notionists";

type Elem<T> = NonNullable<T> extends (infer U)[] ? U : never;

/**
 * Editor de avatar bloqueado a un único estilo de DiceBear (Notionists) para que todos
 * los avatares del sitio compartan el mismo lenguaje visual — nunca se deja elegir
 * estilo, solo rasgos dentro de ese estilo.
 *
 * Segundo cambio de estilo de la sesión: Avataaars (caricatura de colores muy
 * exagerada) → Personas (vector plano, pero seguía leyendo "cara de muñeco" según
 * feedback directo) → Notionists. Se decidió viendo una hoja comparativa de 16 estilos
 * reales, no a ciegas: retrato lineal en blanco y negro, trazo suelto tipo caricatura
 * editorial — el más adulto de los que conservan una cara.
 *
 * A diferencia de Avataaars/Personas, Notionists **no tiene color** (hairColor,
 * skinColor, clothesColor no existen en su esquema — es dibujo monocromo) y sus rasgos
 * son variantes numeradas (`variant01`..`variantNN`), no nombres descriptivos como
 * "shortFlat". El editor por tanto no tiene selectores de color, solo de rasgo.
 *
 * Los tipos de cada rasgo se derivan del propio paquete (`Elem<NotionistsOptions[...]>`)
 * para no desincronizarse si DiceBear cambia sus variantes en una actualización.
 */
export interface AvatarOptions {
  body: Elem<NotionistsOptions["body"]>;
  hair: Elem<NotionistsOptions["hair"]>;
  brows: Elem<NotionistsOptions["brows"]>;
  eyes: Elem<NotionistsOptions["eyes"]>;
  nose: Elem<NotionistsOptions["nose"]>;
  lips: Elem<NotionistsOptions["lips"]>;
  glasses: Elem<NotionistsOptions["glasses"]> | null; // null = sin gafas
  beard: Elem<NotionistsOptions["beard"]> | null; // null = sin barba
  gesture: Elem<NotionistsOptions["gesture"]> | null; // null = sin gesto de mano
}

export const DEFAULT_AVATAR_OPTIONS: AvatarOptions = {
  body: "variant01",
  hair: "variant01",
  brows: "variant01",
  eyes: "variant01",
  nose: "variant01",
  lips: "variant01",
  glasses: null,
  beard: null,
  gesture: null,
};

/**
 * Listas copiadas del propio esquema de `@dicebear/notionists` (no generadas por
 * rango): `hair` en concreto no es una secuencia `variant01..variantNN` limpia, trae
 * 63 variantes numeradas más una opción especial `"hat"` al final, así que derivarla
 * con `Array.from` habría producido un `variant64` que no existe.
 */
export const AVATAR_CHOICES = {
  body: [
    "variant01", "variant02", "variant03", "variant04", "variant05", "variant06", "variant07",
    "variant08", "variant09", "variant10", "variant11", "variant12", "variant13", "variant14",
    "variant15", "variant16", "variant17", "variant18", "variant19", "variant20", "variant21",
    "variant22", "variant23", "variant24", "variant25",
  ],
  hair: [
    "variant01", "variant02", "variant03", "variant04", "variant05", "variant06", "variant07",
    "variant08", "variant09", "variant10", "variant11", "variant12", "variant13", "variant14",
    "variant15", "variant16", "variant17", "variant18", "variant19", "variant20", "variant21",
    "variant22", "variant23", "variant24", "variant25", "variant26", "variant27", "variant28",
    "variant29", "variant30", "variant31", "variant32", "variant33", "variant34", "variant35",
    "variant36", "variant37", "variant38", "variant39", "variant40", "variant41", "variant42",
    "variant43", "variant44", "variant45", "variant46", "variant47", "variant48", "variant49",
    "variant50", "variant51", "variant52", "variant53", "variant54", "variant55", "variant56",
    "variant57", "variant58", "variant59", "variant60", "variant61", "variant62", "variant63",
    "hat",
  ],
  brows: [
    "variant01", "variant02", "variant03", "variant04", "variant05", "variant06", "variant07",
    "variant08", "variant09", "variant10", "variant11", "variant12", "variant13",
  ],
  eyes: ["variant01", "variant02", "variant03", "variant04", "variant05"],
  nose: [
    "variant01", "variant02", "variant03", "variant04", "variant05", "variant06", "variant07",
    "variant08", "variant09", "variant10", "variant11", "variant12", "variant13", "variant14",
    "variant15", "variant16", "variant17", "variant18", "variant19", "variant20",
  ],
  lips: [
    "variant01", "variant02", "variant03", "variant04", "variant05", "variant06", "variant07",
    "variant08", "variant09", "variant10", "variant11", "variant12", "variant13", "variant14",
    "variant15", "variant16", "variant17", "variant18", "variant19", "variant20", "variant21",
    "variant22", "variant23", "variant24", "variant25", "variant26", "variant27", "variant28",
    "variant29", "variant30",
  ],
  glasses: [
    "variant01", "variant02", "variant03", "variant04", "variant05", "variant06", "variant07",
    "variant08", "variant09", "variant10", "variant11",
  ],
  beard: [
    "variant01", "variant02", "variant03", "variant04", "variant05", "variant06", "variant07",
    "variant08", "variant09", "variant10", "variant11", "variant12",
  ],
  gesture: [
    "wavePointLongArms", "waveOkLongArms", "waveLongArms", "waveLongArm", "pointLongArm",
    "okLongArm", "point", "ok", "hand", "handPhone",
  ],
} as const;

/**
 * El fondo del avatar NO se elige: es siempre el acento de marca. Una columna de
 * ranking con cien fondos distintos se ve desordenada, y el avatar ahí funciona como
 * ficha identificativa, no como retrato. Se fuerza al renderizar (no solo en el editor)
 * para que los avatares guardados antes de esta regla se normalicen solos.
 */
export const LOCKED_AVATAR_BACKGROUND = "00d9c0";

export function parseAvatarOptions(character: string | null): AvatarOptions {
  if (!character) return DEFAULT_AVATAR_OPTIONS;
  try {
    const parsed = JSON.parse(character);
    return { ...DEFAULT_AVATAR_OPTIONS, ...parsed };
  } catch {
    return DEFAULT_AVATAR_OPTIONS;
  }
}

export function renderAvatarDataUri(character: string | null): string | null {
  if (!character) return null;
  let options: AvatarOptions;
  try {
    options = parseAvatarOptions(character);
  } catch {
    return null;
  }

  const result = createAvatar(notionists, {
    body: [options.body],
    hair: [options.hair],
    brows: [options.brows],
    eyes: [options.eyes],
    nose: [options.nose],
    lips: [options.lips],
    glasses: options.glasses ? [options.glasses] : undefined,
    glassesProbability: options.glasses ? 100 : 0,
    beard: options.beard ? [options.beard] : undefined,
    beardProbability: options.beard ? 100 : 0,
    gesture: options.gesture ? [options.gesture] : undefined,
    gestureProbability: options.gesture ? 100 : 0,
    backgroundColor: [LOCKED_AVATAR_BACKGROUND],
  });

  return result.toDataUri();
}
