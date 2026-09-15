/**
 * `PostMatchInterviewCandidate` es la única candidata que sigue entrando en un
 * artículo generado por IA (pase "Latest", 2026-09-15) — antes había cinco detectores
 * más aquí (campeón, hito de títulos, sorpresa, racha, hito de ranking) que escaneaban
 * la base de datos buscando qué era noticia y escribían el artículo entero solos, sin
 * que ningún admin decidiera el tema. Pedido explícito del propietario: un admin
 * decide el tema, el torneo, los jugadores etiquetados y el titular a mano (formulario
 * normal, `components/admin/NewsForm.tsx`); la IA como mucho AYUDA a escribir/pulir
 * ese contenido ya decidido (`lib/newsGeneration/enhance.ts`), nunca decide sola de
 * qué escribir. Esta sigue existiendo aparte porque no sale de un escaneo — la
 * construye directamente el bot de Discord (`lib/discordBot/interactions/
 * interviewMessage.ts`) en cuanto un jugador completa su mini-entrevista de 3
 * preguntas: ahí no hay "tema que decidir", siempre va a ser un artículo sobre ESE
 * jugador y ESE partido.
 */
export interface PostMatchInterviewCandidate {
  kind: "post_match_interview";
  autoKey: string;
  editionId: number;
  eventName: string;
  category: string;
  year: number;
  isoWeek: number | null;
  round: string;
  playerId: number;
  playerName: string;
  opponentId: number;
  opponentName: string;
  playerWon: boolean;
  scoreRaw: string | null;
  qa: { question: string; answer: string }[];
}
