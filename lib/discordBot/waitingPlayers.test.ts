import { afterEach, describe, expect, it, vi } from "vitest";
import { clearWaitingByShortName, listCurrentWaitingPlayers, recordWaitingAnnouncement } from "./waitingPlayers";

const announcement = (displayName: string) => ({
  type: "waiting" as const,
  displayName,
  elo: 1000,
  rep: 10,
  sets: 1,
  preview: "No preview",
  difficulty: "Simulation",
  mode: "Realistic",
  comment: "XKT v4.4b",
});

// Estos tres módulos comparten un `Map` a nivel de módulo (por diseño, ver el
// comentario del propio waitingPlayers.ts) — cada test limpia lo suyo para no
// depender del orden en que Vitest los ejecute.
afterEach(() => {
  for (const e of listCurrentWaitingPlayers()) clearWaitingByShortName(e.displayName);
  vi.useRealTimers();
});

describe("recordWaitingAnnouncement / listCurrentWaitingPlayers", () => {
  it("lists a freshly recorded announcement", () => {
    recordWaitingAnnouncement(announcement("Rean Coldsteel"));
    const list = listCurrentWaitingPlayers();
    expect(list).toHaveLength(1);
    expect(list[0].displayName).toBe("Rean Coldsteel");
  });

  it("a second announcement from the same name overwrites the first, not adds a duplicate", () => {
    recordWaitingAnnouncement(announcement("Rean Coldsteel"));
    recordWaitingAnnouncement({ ...announcement("Rean Coldsteel"), elo: 1713 });
    const list = listCurrentWaitingPlayers();
    expect(list).toHaveLength(1);
    expect(list[0].elo).toBe(1713);
  });

  it("orders most recently announced first", () => {
    vi.useFakeTimers();
    recordWaitingAnnouncement(announcement("First"));
    vi.advanceTimersByTime(1000);
    recordWaitingAnnouncement(announcement("Second"));
    const list = listCurrentWaitingPlayers();
    expect(list.map((e) => e.displayName)).toEqual(["Second", "First"]);
  });
});

describe("clearWaitingByShortName", () => {
  it("removes an entry whose full name matches the abbreviated short name from a 'started a game' event", () => {
    recordWaitingAnnouncement(announcement("Rean Coldsteel"));
    clearWaitingByShortName("R.Coldsteel");
    expect(listCurrentWaitingPlayers()).toHaveLength(0);
  });

  it("leaves unrelated entries untouched", () => {
    recordWaitingAnnouncement(announcement("Rean Coldsteel"));
    recordWaitingAnnouncement(announcement("Giuseppe"));
    clearWaitingByShortName("R.Coldsteel");
    const list = listCurrentWaitingPlayers();
    expect(list).toHaveLength(1);
    expect(list[0].displayName).toBe("Giuseppe");
  });

  it("does nothing when no waiting entry matches (e.g. neither player had announced)", () => {
    recordWaitingAnnouncement(announcement("Giuseppe"));
    clearWaitingByShortName("ComeDippers");
    expect(listCurrentWaitingPlayers()).toHaveLength(1);
  });
});

describe("staleness", () => {
  it("drops an announcement older than the stale window", () => {
    vi.useFakeTimers();
    recordWaitingAnnouncement(announcement("Rean Coldsteel"));
    vi.advanceTimersByTime(46 * 60 * 1000);
    expect(listCurrentWaitingPlayers()).toHaveLength(0);
  });

  it("keeps an announcement still within the stale window", () => {
    vi.useFakeTimers();
    recordWaitingAnnouncement(announcement("Rean Coldsteel"));
    vi.advanceTimersByTime(44 * 60 * 1000);
    expect(listCurrentWaitingPlayers()).toHaveLength(1);
  });
});
