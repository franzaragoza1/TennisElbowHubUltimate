import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseLivePage } from "./parseLivePage";

const realFixture = readFileSync(path.join(__dirname, "__fixtures__", "live-te.html"), "utf-8");

describe("parseLivePage — real archived page (2026-08-15 recon, all matches best-of-1)", () => {
  const matches = parseLivePage(realFixture);

  it("finds every live match block", () => {
    expect(matches.length).toBeGreaterThanOrEqual(6);
  });

  it("reads the court title and best-of exactly as the source has it", () => {
    const first = matches[0];
    expect(first.courtTitle).toBe("Abu Dhabi WTA 500");
    expect(first.bestOf).toBe(1);
  });

  it("reads player names without the elo suffix", () => {
    const first = matches[0];
    expect(first.player1.name).toBe("N.Djokovic");
    expect(first.player2.name).toBe("Blackninjagold3.");
  });

  it("reads the live set-in-progress games and current point, no fabricated sets", () => {
    const first = matches[0];
    expect(first.player1.setGames).toEqual(["0"]);
    expect(first.player1.currentPoint).toBe("0");
    expect(first.player2.setGames).toEqual(["2"]);
  });

  it("flags a non-tour court that also appears in the source (negative control for the surfaces filter)", () => {
    expect(matches.some((m) => m.courtTitle === "NewLineSynthetic")).toBe(true);
  });
});

describe("parseLivePage — synthetic best-of-3 match with a set in progress", () => {
  const html = `
    <div class="cResultCourt" version="1" court-id="testcourt">
      <div class="cResultCourtTitle">Cincinnati ATP 1000</div>
      <div class="cResultMatch" match-id="abc123" is-double="0" best-of="3" version="1" match-status="1">
        <div class="cResultMatchMid">
          <table><tbody>
            <tr class="cResultMatchMidTableRowOdd">
              <td>
                PlayerA
                <odds class="cResultMatchOdds">elo: 1000</odds>
                <div>
                  <div><span class="">6</span></div>
                  <div><span class="">3</span></div>
                  <div><span class="">2</span></div>
                  <div class="hidden"></div>
                  <div class="hidden"></div>
                  <div>30</div>
                </div>
              </td>
            </tr>
            <tr class="cResultMatchMidTableRowServe">
              <td>
                PlayerB
                <odds class="cResultMatchOdds">elo: 900</odds>
                <div>
                  <div><span class="">4</span></div>
                  <div><span class="">6</span></div>
                  <div><span class="">1</span></div>
                  <div class="hidden"></div>
                  <div class="hidden"></div>
                  <div>40</div>
                </div>
              </td>
            </tr>
          </tbody></table>
        </div>
      </div>
    </div>
  `;

  const matches = parseLivePage(html);

  it("reads best-of 3 and every set played so far, including the in-progress one", () => {
    expect(matches).toHaveLength(1);
    expect(matches[0].bestOf).toBe(3);
    expect(matches[0].player1.setGames).toEqual(["6", "3", "2"]);
    expect(matches[0].player2.setGames).toEqual(["4", "6", "1"]);
  });

  it("flags the serving player from the row class, not the other one", () => {
    expect(matches[0].player1.serving).toBe(false);
    expect(matches[0].player2.serving).toBe(true);
  });
});
