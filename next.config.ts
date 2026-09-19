import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No dejar que `next dev` le añada un bloque a nuestro CLAUDE.md real (sección 8 de
  // ese mismo fichero: es la especificación del proyecto, no un sitio para que
  // herramientas escriban instrucciones automáticas).
  agentRules: false,

  // Solo afecta a `next dev` (sin efecto en `next build`/producción) — sin esto, Next
  // rechaza en silencio cualquier petición cuyo Origin no sea localhost (protección
  // anti-CSRF de next dev), así que abrir el sitio a través de un túnel HTTPS
  // (trycloudflare.com, necesario para poder probar push notifications desde el
  // móvil — un móvil nunca es `localhost`) dejaba el botón "Sign in" sin hacer nada:
  // el propio `signIn()` de next-auth fallaba callado contra ese bloqueo. El comodín
  // cubre que cada túnel nuevo de `cloudflared tunnel --url` saca un subdominio
  // aleatorio distinto.
  allowedDevOrigins: ["*.trycloudflare.com"],

  // Cabeceras de seguridad básicas — Vercel no las añade por defecto. Deliberadamente
  // SIN Content-Security-Policy aquí: el sitio carga avatares del CDN de Discord,
  // embebidos de YouTube y depende de estilos inline de Tailwind/ECharts — una CSP
  // estricta necesita su propio pase de pruebas cuidadoso, no encajarla de prisa en
  // este endurecimiento general (ver docs/decisiones.md si se retoma más adelante).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      // Sin esto, un navegador puede quedarse sirviendo una versión vieja de este
      // fichero entre despliegues (comportamiento de caché normal de un `.js` estático)
      // — y un service worker desactualizado nunca se entera de que hay un `push`
      // listener nuevo que aplicar.
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;
