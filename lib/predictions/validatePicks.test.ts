import { describe, expect, it } from "vitest";
import { validateBracketPicks } from "./validatePicks";
import type { BracketPick } from "./scoring";
import type { BracketLayout, BracketMatchInput } from "../bracket";

const BYE_PLAYER_ID = -1;

function buildLayout(): BracketLayout<BracketMatchInput> {
  return {
    roundOrder: ["R1", "F"],
    matchesByRound: new Map([
      [
        "R1",
        [
          { match: { id: 1, round: "R1", player1Id: 1, player2Id: 2, winnerId: null, sortIndex: 0 }, round: "R1", y: 0, player1FeederId: null, player2FeederId: null },
          { match: { id: 2, round: "R1", player1Id: 3, player2Id: BYE_PLAYER_ID, winnerId: 3, sortIndex: 1 }, round: "R1", y: 1, player1FeederId: null, player2FeederId: null },
        ],
      ],
      ["F", [{ match: { id: 3, round: "F", player1Id: -2, player2Id: -2, winnerId: null, sortIndex: 0 }, round: "F", y: 0.5, player1FeederId: 1, player2FeederId: 2 }]],
    ]),
    positionById: new Map(),
  };
}

describe("validateBracketPicks", () => {
  it("accepts a fully consistent submission, cascading a pick into the next round", () => {
    const picks: BracketPick[] = [
      { round: "R1", slotIndex: 0, playerId: 1 },
      { round: "F", slotIndex: 0, playerId: 1 }, // 1 llegó a la final por el propio pick de R1
    ];
    expect(validateBracketPicks(picks, buildLayout())).toEqual({ valid: true });
  });

  it("never requires a pick for a bye slot", () => {
    const picks: BracketPick[] = [
      { round: "R1", slotIndex: 0, playerId: 2 },
      { round: "F", slotIndex: 0, playerId: 3 }, // 3 llega solo (bye), sin pick en R1 slot 1
    ];
    expect(validateBracketPicks(picks, buildLayout())).toEqual({ valid: true });
  });

  it("rejects a Final pick that isn't one of the two players the submission's own R1 picks advance", () => {
    const picks: BracketPick[] = [
      { round: "R1", slotIndex: 0, playerId: 1 },
      { round: "F", slotIndex: 0, playerId: 2 }, // 2 fue eliminado por el propio pick de R1 slot 0
    ];
    const result = validateBracketPicks(picks, buildLayout());
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/isn't one of the players/);
  });

  it("accepts a partial submission that leaves a still-undecided R1 matchup unpicked", () => {
    // Pedido explícito, 2026-09-18: R1 se juega a ritmo propio, así que una entrega
    // puede llegar sin pick para un hueco que todavía sigue abierto (o en vivo) — eso
    // ya no es un error, simplemente ese hueco (y lo que dependa de él) queda sin
    // resolver.
    const picks: BracketPick[] = [];
    expect(validateBracketPicks(picks, buildLayout())).toEqual({ valid: true });
  });

  it("rejects an F pick that isn't reachable because its R1 feeder was never picked or decided", () => {
    const picks: BracketPick[] = [{ round: "F", slotIndex: 0, playerId: 1 }];
    const result = validateBracketPicks(picks, buildLayout());
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/isn't one of the players/);
  });

  it("rejects a pick for a real R1 matchup that names a player not actually in it", () => {
    const picks: BracketPick[] = [
      { round: "R1", slotIndex: 0, playerId: 99 },
      { round: "F", slotIndex: 0, playerId: 99 },
    ];
    const result = validateBracketPicks(picks, buildLayout());
    expect(result.valid).toBe(false);
  });

  it("auto-resolves an already-decided R1 slot from the real winner even with no submitted pick for it", () => {
    // El hueco R1 slot 1 (bye, winnerId=3) siempre estuvo decidido "solo"; esto además
    // cubre un R1 slot con un partido real ya jugado (mismo mecanismo: `match.winnerId`
    // manda, el pick es opcional).
    const picks: BracketPick[] = [{ round: "F", slotIndex: 0, playerId: 3 }];
    expect(validateBracketPicks(picks, buildLayout())).toEqual({ valid: true });
  });

  it("rejects a pick that contradicts an already-decided slot's real result", () => {
    const picks: BracketPick[] = [{ round: "R1", slotIndex: 1, playerId: BYE_PLAYER_ID }]; // el bye no puede "perder"
    const result = validateBracketPicks(picks, buildLayout());
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/contradicts the real result/);
  });

  it("treats a Qualifier-slot placeholder id (a large positive synthetic id) as a real, pickable candidate", () => {
    // lib/predictions/qualifierPlaceholder.ts encodes a "Qualifier #N" opponent as a
    // large positive id — this pipeline only ever guards with `> 0`, so it must accept
    // it exactly like a real player id, cascading into later rounds the same way.
    const QUALIFIER_PLACEHOLDER_ID = 900_000_003;
    const layout: BracketLayout<BracketMatchInput> = {
      roundOrder: ["R1", "F"],
      matchesByRound: new Map([
        ["R1", [{ match: { id: 1, round: "R1", player1Id: 109, player2Id: QUALIFIER_PLACEHOLDER_ID, winnerId: null, sortIndex: 1 }, round: "R1", y: 0, player1FeederId: null, player2FeederId: null }]],
        ["F", [{ match: { id: 2, round: "F", player1Id: -2, player2Id: -2, winnerId: null, sortIndex: 0 }, round: "F", y: 0, player1FeederId: 1, player2FeederId: null }]],
      ]),
      positionById: new Map(),
    };
    const picks: BracketPick[] = [
      { round: "R1", slotIndex: 0, playerId: QUALIFIER_PLACEHOLDER_ID },
      { round: "F", slotIndex: 0, playerId: QUALIFIER_PLACEHOLDER_ID },
    ];
    expect(validateBracketPicks(picks, layout)).toEqual({ valid: true });
  });
});
