import localFont from "next/font/local";

/**
 * Inter para todo el sitio (CLAUDE.md §6). Variable font, ejes de peso 100-900 y tamaño
 * óptico 14-32 — los titulares usan 800 (ExtraBold) con tracking negativo, ver
 * `.text-headline` en globals.css. También trae la feature `tnum` (dígitos tabulares de
 * fábrica), así que `.tour-numeric` puede usar `font-variant-numeric: tabular-nums` de
 * verdad: sin eso las columnas de ranking, puntos y marcadores bailarían al cambiar de
 * valor.
 *
 * Partida en dos ficheros WOFF2 por `unicode-range` (pase de rendimiento, 2026-10-11,
 * ver docs/decisiones.md): antes se servía el TTF entero (875 KB, 467 KB comprimido) y
 * además DOS veces — el nombre del fichero llevaba una coma (`opsz,wght`) que el
 * `<link rel=preload>` escribía como `%2C` y el `@font-face` tal cual, y el navegador
 * los trataba como dos ficheros distintos. Ahora:
 *   - `interLatin`: latín básico + Latin-1 + puntuación, flechas y símbolos (112 KB) —
 *     lo único que necesita casi cualquier página; se precarga.
 *   - `interExtended`: el resto (latín extendido, griego, cirílico… 297 KB) — el
 *     navegador solo lo descarga si la página contiene algún carácter de esos rangos
 *     (p.ej. un nombre de jugador en cirílico).
 * Mismos ejes y mismas features en los dos (subconjuntos de fontTools con
 * `--layout-features='*'`), así que el aspecto no cambia.
 *
 * (Los rangos van escritos tal cual dentro de cada `localFont`: next/font exige literales.)
 *
 * `adjustFontFallback: false` en el latino a propósito: su variable CSS lleva solo su
 * propia familia, sin la de respaldo (Arial ajustada) detrás — si la llevara, un
 * carácter cirílico caería en ESA Arial antes de llegar a `interExtended`. La de
 * respaldo ajustada sigue existiendo, en la variable de `interExtended`, al final de la
 * pila (globals.css `--font-sans`).
 */


export const interLatin = localFont({
  src: [{ path: "../public/font/Inter-Latin.woff2", style: "normal" }],
  variable: "--font-inter-latin",
  display: "swap",
  weight: "100 900",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2190-21FF, U+2212, U+2215, U+25A0-25FF, U+FEFF, U+FFFD" }],
});

export const interExtended = localFont({
  src: [{ path: "../public/font/Inter-Extended.woff2", style: "normal" }],
  variable: "--font-inter-extended",
  display: "swap",
  weight: "100 900",
  preload: false,
  declarations: [{ prop: "unicode-range", value:
        "U+0100-0130, U+0132-0151, U+0154-02BA, U+02BD-02C5, U+02C7-02D9, U+02DB, U+02DD-0303, U+0305-0307, U+0309-0328, U+032A-052F, U+1E00-1EFF, U+2070-20AB, U+20AD-2121, U+2123-218F, U+2200-2211, U+2213-2214, U+2216-23FF, U+2600-27BF, U+FB00-FB06" }],
});
