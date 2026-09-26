/**
 * Lee a mano las fichas de jugador pendientes (país) — mismo importador que la pasada
 * periódica de scripts/autoScrape.ts, pero con el tope que se le pase.
 *
 * Uso: npm run profiles -- 40
 */
import { refreshPlayerProfiles } from "../lib/mana/loadPlayerProfiles";

async function main() {
  const limit = Number(process.argv[2] ?? 20);
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Usage: npm run profiles -- <max profiles>");
  const result = await refreshPlayerProfiles({ limit, headless: true });
  console.log(`✓ ${result.checked} fichas leídas, ${result.countriesSet} con país, ${result.failed} fallidas`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Error fatal:", err);
    process.exit(1);
  });
