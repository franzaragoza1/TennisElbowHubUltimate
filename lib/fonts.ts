import localFont from "next/font/local";

/**
 * Quicksand para todo el texto. Su eje de pesos llega a 700, no a 800, así que los
 * titulares usan 700 (ver `.text-headline` en globals.css).
 */
export const quicksand = localFont({
  src: [
    {
      path: "../public/font/Quicksand-VariableFont_wght.ttf",
      style: "normal",
    },
  ],
  variable: "--font-quicksand",
  display: "swap",
  weight: "300 700",
});

/**
 * Inter se queda **solo para las cifras**. No es un capricho: Quicksand no declara la
 * feature `tnum` y sus dígitos son proporcionales de fábrica (el "1" mide 363/1000em
 * frente a los 588 del "0"), así que `font-variant-numeric: tabular-nums` no haría nada
 * y las columnas de ranking, puntos y marcadores bailarían al cambiar de valor — justo
 * lo que CLAUDE.md §6 prohíbe. Inter sí trae `tnum`.
 *
 * Se aplica vía la clase `.tour-numeric`, que ya está en todas las cifras del sitio.
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
