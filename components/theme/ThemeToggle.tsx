"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "te4-theme";

type Theme = "dark" | "light";

const listeners = new Set<() => void>();

function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

// En el servidor no hay `document`: se deja el hueco vacío (ver más abajo) hasta que
// el cliente hidrata y lee el atributo que ya puso ThemeScript, sin parpadeo de tema.
function getServerSnapshot(): Theme | null {
  return null;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function applyTheme(next: Theme) {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // localStorage bloqueado (modo privado, etc.) — el toggle sigue funcionando en memoria
  }
  listeners.forEach((listener) => listener());
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    applyTheme(theme === "light" ? "dark" : "light");
  }

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
