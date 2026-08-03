"use client";

// src/hooks/useTheme.ts
// Toggle de tema claro/oscuro con persistencia en localStorage

import { useEffect, useState, useCallback } from "react";

export type Tema = "claro" | "oscuro" | "sistema";

function getTemaActual(tema: Tema): "claro" | "oscuro" {
  if (tema === "sistema") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "oscuro"
      : "claro";
  }
  return tema;
}

export function useTheme() {
  const [tema, setTemaState] = useState<Tema>("sistema");

  // Leer localStorage al montar
  useEffect(() => {
    const guardado = localStorage.getItem("monteflori-tema") as Tema | null;
    if (guardado) {
      setTemaState(guardado);
      aplicarTema(guardado);
    } else {
      aplicarTema("sistema");
    }
  }, []);

  function aplicarTema(t: Tema) {
    const resuelto = getTemaActual(t);
    const html = document.documentElement;
    if (resuelto === "oscuro") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
  }

  const setTema = useCallback((nuevoTema: Tema) => {
    setTemaState(nuevoTema);
    localStorage.setItem("monteflori-tema", nuevoTema);
    aplicarTema(nuevoTema);
  }, []);

  const toggleTema = useCallback(() => {
    const actual = getTemaActual(tema);
    setTema(actual === "oscuro" ? "claro" : "oscuro");
  }, [tema, setTema]);

  return { tema, setTema, toggleTema, temaActual: tema };
}
