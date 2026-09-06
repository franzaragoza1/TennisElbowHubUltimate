export interface SeededRegistration {
  playerId: number;
  seed: number | null;
}

export interface RoundOneMatch {
  slotIndex: number;
  player1Id: number;
  player2Id: number;
}

export interface RoundOneBye {
  slotIndex: number;
  playerId: number;
}

export interface RoundOnePlacement {
  matches: RoundOneMatch[];
  byes: RoundOneBye[];
}

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Orden de siembra estándar de un cuadro de eliminación directa: para cada tamaño da
 * qué número de seed (1..n) le toca a cada hueco, de arriba abajo — construido
 * recursivamente para que el 1 y el 2 nunca puedan cruzarse antes de la final, el
 * 1-4 no antes de semis, etc. (el mismo patrón que cualquier cuadro real de tenis:
 * n=8 -> 1,8,4,5,2,7,3,6).
 */
function seedOrder(n: number): number[] {
  if (n === 1) return [1];
  const half = seedOrder(n / 2);
  const result: number[] = [];
  for (const seed of half) {
    result.push(seed, n + 1 - seed);
  }
  return result;
}

/**
 * Coloca inscritos en los huecos de un cuadro de `drawSize` (potencia de 2) siguiendo
 * la siembra estándar — quien tiene seed va a su hueco protegido; el resto rellena
 * los huecos que sobran, en el orden dado (normalmente orden de inscripción). Si no
 * hay bastantes inscritos para llenar el cuadro, los huecos que faltan quedan vacíos
 * empezando SIEMPRE por los números de seed más altos (los menos protegidos) — así
 * los byes resultantes caen solos en los mejores seeds, sin necesitar ninguna regla
 * aparte para "a quién le toca el bye".
 *
 * Cada pareja de huecos consecutivos (0-1, 2-3, ...) es una posición de R1: los dos
 * llenos = partido real (`pendingSlots`, sin resultado todavía); uno lleno = bye; los
 * dos vacíos no puede pasar — se exige `registrations.length >= drawSize / 2` para
 * que ninguna pareja se quede sin NINGÚN jugador real (esa rama del cuadro no tendría
 * quién avanzar).
 */
export function placeSeedsIntoBracket(registrations: SeededRegistration[], drawSize: number): RoundOnePlacement {
  if (!isPowerOfTwo(drawSize)) throw new Error(`drawSize debe ser potencia de 2, se recibió ${drawSize}`);
  if (registrations.length < drawSize / 2) {
    throw new Error(`Hacen falta al menos ${drawSize / 2} inscritos para un cuadro de ${drawSize} (hay ${registrations.length})`);
  }

  const seeded = registrations.filter((r) => r.seed !== null).sort((a, b) => a.seed! - b.seed!);
  const unseeded = registrations.filter((r) => r.seed === null);
  const priorityOrder = [...seeded, ...unseeded].map((r) => r.playerId);

  const order = seedOrder(drawSize);
  const playerBySlot: (number | null)[] = order.map((seedNumber) => priorityOrder[seedNumber - 1] ?? null);

  const matches: RoundOneMatch[] = [];
  const byes: RoundOneBye[] = [];
  for (let slotIndex = 0; slotIndex < drawSize / 2; slotIndex++) {
    const a = playerBySlot[slotIndex * 2];
    const b = playerBySlot[slotIndex * 2 + 1];
    if (a !== null && b !== null) matches.push({ slotIndex, player1Id: a, player2Id: b });
    else if (a !== null) byes.push({ slotIndex, playerId: a });
    else if (b !== null) byes.push({ slotIndex, playerId: b });
    else throw new Error(`Hueco ${slotIndex} sin ningún jugador real — no debería pasar con la validación de arriba`);
  }

  return { matches, byes };
}
