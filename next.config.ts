import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No dejar que `next dev` le añada un bloque a nuestro CLAUDE.md real (sección 8 de
  // ese mismo fichero: es la especificación del proyecto, no un sitio para que
  // herramientas escriban instrucciones automáticas).
  agentRules: false,
};

export default nextConfig;
