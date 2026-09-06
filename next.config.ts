import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No dejar que `next dev` le añada un bloque a nuestro CLAUDE.md real (sección 8 de
  // ese mismo fichero: es la especificación del proyecto, no un sitio para que
  // herramientas escriban instrucciones automáticas).
  agentRules: false,

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
    ];
  },
};

export default nextConfig;
