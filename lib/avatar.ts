import { createAvatar } from "@dicebear/core";
import * as personas from "@dicebear/personas";
import type { Options as PersonasOptions } from "@dicebear/personas";

type Elem<T> = NonNullable<T> extends (infer U)[] ? U : never;

/**
 * Editor de avatar bloqueado a un único estilo de DiceBear (Personas) para que todos
 * los avatares del sitio compartan el mismo lenguaje visual — nunca se deja elegir
 * estilo, solo rasgos dentro de ese estilo.
 *
 * Cambiado desde Avataaars: su caricatura de rasgos muy exagerados leía como una app
 * infantil y rompía la inmersión de un sitio que se quiere ver "oficial". Personas es
 * vector plano con proporciones adultas y sin esa lectura de dibujo animado.
 *
 * Los tipos de cada rasgo se derivan del propio paquete (`Elem<PersonasOptions[...]>`)
 * para no desincronizarse si DiceBear cambia sus enums en una actualización.
 */
export interface AvatarOptions {
  body: Elem<PersonasOptions["body"]>;
  hair: Elem<PersonasOptions["hair"]>;
  hairColor: string;
  skinColor: string;
  eyes: Elem<PersonasOptions["eyes"]>;
  mouth: Elem<PersonasOptions["mouth"]>;
  nose: Elem<PersonasOptions["nose"]>;
  facialHair: Elem<PersonasOptions["facialHair"]> | null; // null = sin vello facial
  clothingColor: string;
}

export const DEFAULT_AVATAR_OPTIONS: AvatarOptions = {
  body: "rounded",
  hair: "shortCombover",
  hairColor: "362c47",
  skinColor: "e7a391",
  eyes: "open",
  mouth: "smile",
  nose: "mediumRound",
  facialHair: null,
  clothingColor: "456dff",
};

export const AVATAR_CHOICES = {
  body: ["squared", "rounded", "small", "checkered"],
  hair: [
    "long", "sideShave", "shortCombover", "curlyHighTop", "bobCut", "curly", "pigtails",
    "curlyBun", "buzzcut", "bobBangs", "bald", "balding", "cap", "bunUndercut", "fade",
    "beanie", "straightBun", "extraLong", "shortComboverChops", "mohawk",
  ],
  eyes: ["open", "sleep", "wink", "glasses", "happy", "sunglasses"],
  mouth: ["smile", "frown", "surprise", "pacifier", "bigSmile", "smirk", "lips"],
  nose: ["mediumRound", "smallRound", "wrinkles"],
  facialHair: ["beardMustache", "pyramid", "walrus", "goatee", "shadow", "soulPatch"],
  hairColor: ["362c47", "6c4545", "e15c66", "e16381", "f27d65", "f29c65", "dee1f5"],
  skinColor: ["eeb4a4", "e7a391", "e5a07e", "d78774", "b16a5b", "92594b", "623d36"],
  clothingColor: ["456dff", "54d7c7", "7555ca", "6dbb58", "e24553", "f3b63a", "f55d81"],
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

  const result = createAvatar(personas, {
    body: [options.body],
    hair: [options.hair],
    hairColor: [options.hairColor],
    skinColor: [options.skinColor],
    eyes: [options.eyes],
    mouth: [options.mouth],
    nose: [options.nose],
    facialHair: options.facialHair ? [options.facialHair] : undefined,
    facialHairProbability: options.facialHair ? 100 : 0,
    clothingColor: [options.clothingColor],
    backgroundColor: [LOCKED_AVATAR_BACKGROUND],
  });

  return result.toDataUri();
}
