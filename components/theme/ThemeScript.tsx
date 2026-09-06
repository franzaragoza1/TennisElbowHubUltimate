import Script from "next/script";

/**
 * Fija `data-theme` en <html> ANTES del primer pintado (strategy="beforeInteractive"),
 * para que no haya parpadeo de "tema equivocado" mientras React hidrata. Oscuro es el
 * valor por defecto del sitio — si no hay preferencia guardada, se queda en oscuro, no
 * seguimos `prefers-color-scheme` del sistema.
 */
const THEME_INIT = `
(function () {
  try {
    var stored = localStorage.getItem("te4-theme");
    document.documentElement.dataset.theme = stored === "light" ? "light" : "dark";
  } catch (e) {
    document.documentElement.dataset.theme = "dark";
  }
})();
`;

export function ThemeScript() {
  return (
    // App Router soporta explícitamente beforeInteractive en el root layout (no hay
    // pages/_document.js en este proyecto); la regla es una herencia del Pages Router.
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script id="theme-init" strategy="beforeInteractive">
      {THEME_INIT}
    </Script>
  );
}
