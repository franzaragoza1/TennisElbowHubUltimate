"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "te4-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light" | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage bloqueado (modo privado, etc.) — el toggle sigue funcionando en memoria
    }
  }

  // se resuelve en el primer efecto a partir del atributo que ya puso ThemeScript;
  // hasta entonces no se sabe qué icono pintar, así que se deja el hueco vacío.
  if (theme === null) return <span className="h-8 w-8 shrink-0" aria-hidden="true" />;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="tap-scale relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
    >
      {theme === "dark" ? (
        <svg
          key="sun"
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="animate-in fade-in zoom-in-50 spin-in-45 duration-300 ease-out"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg
          key="moon"
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="animate-in fade-in zoom-in-50 spin-in-45 duration-300 ease-out"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      )}
    </button>
  );
}
