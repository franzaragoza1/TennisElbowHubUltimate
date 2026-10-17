import { describe, expect, it } from "vitest";
import { matchKey, pendingKey, planReconcile } from "./reconcile";

type Row = { id: number; key: string };
type In = { key: string; score: string };
const plan = (ex: Row[], inc: In[]) => planReconcile(ex, inc, (e) => e.key, (i) => i.key);

describe("planReconcile", () => {
  it("conserva el id de lo que sigue en la página y solo inserta lo nuevo", () => {
    const p = plan([{ id: 1, key: "a" }, { id: 2, key: "b" }], [{ key: "a", score: "6-4" }, { key: "b", score: "6-3" }, { key: "c", score: "7-5" }]);
    expect(p.updates.map((u) => u.existing.id)).toEqual([1, 2]);
    expect(p.inserts.map((i) => i.key)).toEqual(["c"]);
    expect(p.deletes).toEqual([]);
  });

  it("borra solo lo que ya no está", () => {
    const p = plan([{ id: 1, key: "a" }, { id: 2, key: "gone" }], [{ key: "a", score: "" }]);
    expect(p.deletes.map((d) => d.id)).toEqual([2]);
  });

  it("claves repetidas se emparejan una a una", () => {
    const p = plan([{ id: 1, key: "a" }, { id: 2, key: "a" }], [{ key: "a", score: "" }]);
    expect(p.updates).toHaveLength(1);
    expect(p.deletes.map((d) => d.id)).toEqual([2]);
  });
});

describe("claves", () => {
  it("un partido es el mismo con los jugadores en cualquier orden", () => {
    expect(matchKey("F", 5, 9)).toBe(matchKey("F", 9, 5));
    expect(matchKey("F", 5, 9)).not.toBe(matchKey("S", 5, 9));
  });
  it("un hueco pendiente se identifica por su posición", () => {
    expect(pendingKey("R2", 3)).toBe("R2|3");
  });
});
