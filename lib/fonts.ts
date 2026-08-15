import localFont from "next/font/local";

/**
 * Inter para todo el sitio (CLAUDE.md §6). Variable font, eje de peso 100-900 — los
 * titulares usan 800 (ExtraBold) con tracking negativo, ver `.text-headline` en
 * globals.css. También trae la feature `tnum` (dígitos tabulares de fábrica), así que
 * `.tour-numeric` puede usar `font-variant-numeric: tabular-nums` de verdad: sin eso
 * las columnas de ranking, puntos y marcadores bailarían al cambiar de valor.
 */
export const inter = localFont({
  src: [
    {
      path: "../public/font/Inter-VariableFont_opsz,wght.ttf",
      style: "normal",
    },
  ],
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});
