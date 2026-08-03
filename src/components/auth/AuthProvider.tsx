"use client";

// src/components/auth/AuthProvider.tsx
// Contexto global de autenticación + inicialización del tema

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Inicializar tema desde localStorage
  useEffect(() => {
    const tema = localStorage.getItem("monteflori-tema");
    const html = document.documentElement;
    if (tema === "oscuro") {
      html.classList.add("dark");
      html.classList.remove("light");
    } else if (tema === "claro") {
      html.classList.add("light");
      html.classList.remove("dark");
    }
    // "sistema" deja que el @media lo maneje
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
