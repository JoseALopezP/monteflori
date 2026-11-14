"use client";

// src/app/(auth)/login/page.tsx
// Inicio de sesión.

import { useState } from "react";
import Link from "next/link";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { crearPerfilUsuario } from "@/lib/firestore";
import { AuthShell, BotonGoogle, CampoPassword, Separador } from "@/components/auth/AuthShell";
import { Spinner } from "@/components/ui/kit";

const provider = new GoogleAuthProvider();

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al entrar no hace falta navegar: AuthShell detecta la sesión y manda al inicio.

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setError("El email o la contraseña no coinciden. Revisalos e intentá de nuevo.");
      } else if (code === "auth/invalid-email") {
        setError("Ese email no parece válido.");
      } else if (code === "auth/too-many-requests") {
        setError("Demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.");
      } else if (code === "auth/network-request-failed") {
        setError("No hay conexión. Revisá tu internet e intentá de nuevo.");
      } else {
        setError("No pudimos iniciar sesión. Intentá de nuevo.");
      }
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoadingGoogle(true);
    try {
      const cred = await signInWithPopup(auth, provider);
      // Si es la primera vez que esta persona entra (nunca pasó por /register),
      // todavía no tiene documento en Firestore. crearPerfilUsuario no hace
      // nada si ya existe, así que es seguro llamarlo en cada login.
      await crearPerfilUsuario(cred.user.uid, cred.user.displayName ?? "Estudiante", cred.user.email ?? "");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      // Cerrar la ventana de Google no es un error: no hay nada que avisar.
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError(
          code === "auth/popup-blocked"
            ? "El navegador bloqueó la ventana de Google. Permití las ventanas emergentes para este sitio."
            : "No pudimos entrar con Google. Intentá de nuevo."
        );
      }
      setLoadingGoogle(false);
    }
  }

  return (
    <AuthShell titulo="Hola de nuevo" subtitulo="Entrá para seguir tu carrera donde la dejaste.">
      {error && <div className="notice notice-error mb-4" role="alert">{error}</div>}

      <BotonGoogle id="btn-login-google" onClick={handleGoogle} cargando={loadingGoogle}>
        Entrar con Google
      </BotonGoogle>

      <Separador />

      <form onSubmit={handleEmail} className="space-y-4">
        <div>
          <label className="label" htmlFor="login-email">Email</label>
          <input id="login-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)}
            required autoComplete="email" placeholder="vos@ejemplo.com" />
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label className="label" htmlFor="login-password">Contraseña</label>
            <Link href="/forgot-password" className="link text-xs">¿La olvidaste?</Link>
          </div>
          <CampoPassword id="login-password" value={password} onChange={setPassword} autoComplete="current-password"
            mostrar={showPass} onAlternar={() => setShowPass((v) => !v)} />
        </div>

        <button id="btn-login-email" type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block">
          {loading && <Spinner />}
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p className="text-center text-sm text-foreground-muted mt-6">
        ¿Todavía no tenés cuenta? <Link href="/register" className="link">Creala gratis</Link>
      </p>
    </AuthShell>
  );
}
