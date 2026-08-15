const LIVE_TENNIS_URL = "https://www.live-tennis.cn/zh/te";

/**
 * A diferencia de Mana Games, esta página no tiene verificación anti-bot en esta ruta
 * (comprobado con curl plano — el HTML de partidos ya viene servido, sin JS) — un
 * `fetch()` normal basta, no hace falta Playwright ni contexto persistente. Ver
 * docs/decisiones.md para el detalle del reconocimiento y el riesgo conocido: el
 * dominio SÍ tiene Cloudflare por delante en otras rutas (`/robots.txt` devolvió un
 * challenge), así que esto puede empezar a fallar si Cloudflare decide vigilar también
 * esta ruta — de ahí el `try/catch` en el caller, nunca se lanza aquí un error que
 * tumbe la sección entera.
 */
export async function fetchLiveHtml(): Promise<string> {
  const response = await fetch(LIVE_TENNIS_URL, {
    headers: {
      "User-Agent": "TE4TourBot/0.1 (+mailto:thelolosmusica@gmail.com)",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`live-tennis.cn respondió ${response.status}`);
  return response.text();
}
