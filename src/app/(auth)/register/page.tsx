"use client";

// src/app/(auth)/register/page.tsx
// Alta de cuenta. Pide lo mínimo: nombre, email y contraseña. La facultad y
// el resto se completan después, desde el perfil o al cargar la carrera.

import { useState } from "react";
import Link from "next/link";
import {
  createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { crearPerfilUsuario } from "@/lib/firestore";
import { AuthShell, BotonGoogle, CampoPassword, Separador } from "@/components/auth/AuthShell";
import { Spinner } from "@/components/ui/kit";

const provider = new GoogleAuthProvider();
const MINIMO = 8;

export default function RegisterPage() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al crear la cuenta no hace falta navegar: AuthShell detecta la sesión y
  // manda al inicio, donde arranca la bienvenida.

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { setError("Decinos cómo te llamás."); return; }
    if (password.length < MINIMO) {
      setError(`La contraseña tiene que tener al menos ${MINIMO} caracteres.`);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: nombre.trim() });
      await crearPerfilUsuario(cred.user.uid, nombre.trim(), email.trim());
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/email-already-in-use") {
        setError("Ya hay una cuenta con ese email. Probá iniciar sesión.");
      } else if (code === "auth/invalid-email") {
        setError("Ese email no parece válido.");
      } else if (code === "auth/weak-password") {
        setError("Esa contraseña es muy fácil de adivinar. Probá con una más larga.");
      } else if (code === "auth/network-request-failed") {
        setError("No hay conexión. Revisá tu internet e intentá de nuevo.");
      } else {
        setError("No pudimos crear la cuenta. Intentá de nuevo.");
      }
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoadingGoogle(true);
    try {
      const cred = await signInWithPopup(auth, provider);
      await crearPerfilUsuario(cred.user.uid, cred.user.displayName ?? "Estudiante", cred.user.email ?? "");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError(
          code === "auth/popup-blocked"
            ? "El navegador bloqueó la ventana de Google. Permití las ventanas emergentes para este sitio."
            : "No pudimos registrarte con Google. Intentá de nuevo."
        );
      }
      setLoadingGoogle(false);
    }
  }

  const faltan = MINIMO - password.length;

  return (
    <AuthShell titulo="Creá tu cuenta" subtitulo="Es gratis y te lleva menos de un minuto.">
      {error && <div className="notice notice-error mb-4" role="alert">{error}</div>}

      <BotonGoogle id="btn-register-google" onClick={handleGoogle} cargando={loadingGoogle}>
        Registrarme con Google
      </BotonGoogle>

      <Separador />

      <form onSubmit={handleRegister} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="reg-nombre">¿Cómo te llamás?</label>
          <input id="reg-nombre" type="text" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)}
            required autoComplete="name" placeholder="Nombre y apellido" maxLength={200} />
        </div>

        <div>
          <label className="label" htmlFor="reg-email">Email</label>
          <input id="reg-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)}
            required autoComplete="email" placeholder="vos@ejemplo.com" />
        </div>

        <div>
          <label className="label" htmlFor="reg-password">Contraseña</label>
          <CampoPassword id="reg-password" value={password} onChange={setPassword} autoComplete="new-password"
            mostrar={showPass} onAlternar={() => setShowPass((v) => !v)} />
          <p className="hint" aria-live="polite">
            {password.length === 0
              ? `Al menos ${MINIMO} caracteres.`
              : faltan > 0
              ? `Te ${faltan === 1 ? "falta 1 caracter" : `faltan ${faltan} caracteres`}.`
              : "Perfecto."}
          </p>
        </div>

        <button id="btn-register-email" type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block">
          {loading && <Spinner />}
          {loading ? "Creando tu cuenta..." : "Crear cuenta"}
        </button>
      </form>

      <p className="text-center text-sm text-foreground-muted mt-6">
        ¿Ya tenés cuenta? <Link href="/login" className="link">Iniciá sesión</Link>
      </p>
    </AuthShell>
  );
}
