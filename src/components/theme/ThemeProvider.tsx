"use client";

// src/components/theme/ThemeProvider.tsx
// Estado global de tema claro/oscuro/sistema.
//
// Única fuente de verdad: la clase .dark en <html>. La pone por primera vez el
// script inline de layout.tsx (antes del primer pintado) y acá se mantiene.
// La preferencia se guarda en localStorage y se lee con useSyncExternalStore,
// así varias pestañas y todos los componentes ven siempre el mismo valor.

import {
  createContext, useCallback, useContext, useEffect, useSyncExternalStore, ReactNode,
} from "react";

export type Tema = "claro" | "oscuro" | "sistema";

const CLAVE = "monteflori-tema";
const EVENTO = "monteflori-tema-cambio";

function leerTema(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE);
    return guardado === "claro" || guardado === "oscuro" ? guardado : "sistema";
  } catch {
    return "sistema";
  }
}

function suscribirTema(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENTO, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENTO, callback);
  };
}

const CONSULTA_OSCURO = "(prefers-color-scheme: dark)";

function suscribirSistema(callback: () => void) {
  const mql = window.matchMedia(CONSULTA_OSCURO);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

interface ThemeContextValue {
  tema: Tema;
  temaResuelto: "claro" | "oscuro";
  setTema: (t: Tema) => void;
  toggleTema: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  tema: "sistema",
  temaResuelto: "claro",
  setTema: () => {},
  toggleTema: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const tema = useSyncExternalStore<Tema>(suscribirTema, leerTema, () => "sistema");
  const prefiereOscuro = useSyncExternalStore(
    suscribirSistema,
    () => window.matchMedia(CONSULTA_OSCURO).matches,
    () => false
  );

  const temaResuelto: "claro" | "oscuro" =
    tema === "sistema" ? (prefiereOscuro ? "oscuro" : "claro") : tema;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", temaResuelto === "oscuro");
  }, [temaResuelto]);

  const setTema = useCallback((nuevo: Tema) => {
    try {
      if (nuevo === "sistema") localStorage.removeItem(CLAVE);
      else localStorage.setItem(CLAVE, nuevo);
    } catch {
      // Modo privado sin storage: el tema igual cambia en esta pestaña.
    }
    window.dispatchEvent(new Event(EVENTO));
  }, []);

  const toggleTema = useCallback(() => {
    setTema(temaResuelto === "oscuro" ? "claro" : "oscuro");
  }, [temaResuelto, setTema]);

  return (
    <ThemeContext.Provider value={{ tema, temaResuelto, setTema, toggleTema }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
