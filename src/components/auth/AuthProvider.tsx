"use client";

// src/components/auth/AuthProvider.tsx
// Contexto global de autenticación.

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
  const [estado, setEstado] = useState<AuthContextValue>({ user: null, loading: true });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setEstado({ user: u, loading: false });
    });
    return () => unsub();
  }, []);

  return <AuthContext.Provider value={estado}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}
