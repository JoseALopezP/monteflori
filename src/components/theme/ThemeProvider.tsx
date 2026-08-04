"use client";

// src/components/theme/ThemeProvider.tsx
// Estado global de tema claro/oscuro/sistema. Antes cada componente que
// llamaba useTheme() tenía su propio estado local — cambiar el tema desde
// el navbar no se reflejaba en otros componentes montados (ej. el selector
// de /configuracion) hasta recargar la página. Con contexto, todos comparten
// la misma fuente de verdad y se re-renderizan juntos al cambiar.

import {
  createContext, useCallback, useContext, useEffect, useState, ReactNode,
} from "react";

export type Tema = "claro" | "oscuro" | "sistema";

function resolverTema(tema: Tema, prefiereOscuro: boolean): "claro" | "oscuro" {
  if (tema === "sistema") return prefiereOscuro ? "oscuro" : "claro";
  return tema;
}

function aplicarAlDOM(resuelto: "claro" | "oscuro") {
  const html = document.documentElement;
  if (resuelto === "oscuro") html.classList.add("dark");
  else html.classList.remove("dark");
}

interface ThemeContextValue {
  tema: Tema;
  temaActual: Tema;
  temaResuelto: "claro" | "oscuro";
  setTema: (t: Tema) => void;
  toggleTema: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  tema: "sistema",
  temaActual: "sistema",
  temaResuelto: "claro",
  setTema: () => {},
  toggleTema: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTemaState] = useState<Tema>("sistema");
  const [prefiereOscuro, setPrefiereOscuro] = useState(false);

  // Leer localStorage al montar + suscribirse a cambios del tema del SO
  useEffect(() => {
    const guardado = localStorage.getItem("monteflori-tema") as Tema | null;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    setPrefiereOscuro(mql.matches);
    if (guardado) setTemaState(guardado);

    const onChange = (e: MediaQueryListEvent) => setPrefiereOscuro(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Aplicar al DOM cada vez que cambia el tema elegido o el del SO
  useEffect(() => {
    aplicarAlDOM(resolverTema(tema, prefiereOscuro));
  }, [tema, prefiereOscuro]);

  const setTema = useCallback((nuevoTema: Tema) => {
    setTemaState(nuevoTema);
    localStorage.setItem("monteflori-tema", nuevoTema);
  }, []);

  const toggleTema = useCallback(() => {
    const actual = resolverTema(tema, prefiereOscuro);
    setTema(actual === "oscuro" ? "claro" : "oscuro");
  }, [tema, prefiereOscuro, setTema]);

  const temaResuelto = resolverTema(tema, prefiereOscuro);

  return (
    <ThemeContext.Provider value={{ tema, temaActual: tema, temaResuelto, setTema, toggleTema }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
