"use client";

// src/app/(auth)/login/page.tsx
// Página de inicio de sesión de Monteflori

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { BookOpen, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";

const provider = new GoogleAuthProvider();

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (err: unknown) {
      const msg = (err as { code?: string })?.code;
      if (msg === "auth/invalid-credential" || msg === "auth/wrong-password") {
        setError("Email o contraseña incorrectos.");
      } else if (msg === "auth/too-many-requests") {
        setError("Demasiados intentos. Esperá unos minutos.");
      } else {
        setError("Error al iniciar sesión. Intentá de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoadingGoogle(true);
    try {
      await signInWithPopup(auth, provider);
      router.push("/");
    } catch {
      setError("No se pudo iniciar sesión con Google.");
    } finally {
      setLoadingGoogle(false);
    }
  }

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {/* Luces/Blobs de fondo animadas */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 0 }}
      >
        <div
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: "var(--color-primary)", filter: "blur(90px)" }}
        />
        <div
          className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-15"
          style={{ background: "var(--color-secondary)", filter: "blur(90px)" }}
        />
      </div>

      {/* Contenedor Principal */}
      <div
        className="relative w-full max-w-md my-auto animate-fade-in flex flex-col gap-6"
        style={{ zIndex: 1 }}
      >
        {/* Cabecera / Logo */}
        <div className="flex flex-col items-center text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-md transition-transform hover:scale-105"
            style={{ background: "var(--color-primary)" }}
          >
            <BookOpen size={28} color="white" />
          </div>
          <h1
            className="text-2xl sm:text-3xl font-extrabold tracking-tight"
            style={{ color: "var(--foreground)" }}
          >
            Monteflori
          </h1>
          <p
            className="text-sm mt-1 font-medium"
            style={{ color: "var(--foreground-muted)" }}
          >
            Gestión Académica Inteligente
          </p>
        </div>

        {/* Tarjeta de Formulario */}
        <div
          className="rounded-2xl p-6 sm:p-8 shadow-xl border flex flex-col gap-5"
          style={{
            background: "var(--color-card)",
            borderColor: "var(--color-card-border)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div className="flex flex-col gap-1">
            <h2
              className="text-xl font-bold"
              style={{ color: "var(--foreground)" }}
            >
              Iniciar sesión
            </h2>
            <p
              className="text-xs"
              style={{ color: "var(--foreground-subtle)" }}
            >
              Ingresá con tus credenciales para acceder a tus materias
            </p>
          </div>

          {/* Mensaje de Error */}
          {error && (
            <div
              className="p-3.5 rounded-xl text-xs font-semibold animate-fade-in flex items-center gap-2"
              style={{
                background: "var(--estado-libre-bg)",
                color: "var(--color-alert)",
                border: "1px solid var(--color-alert-light)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Formulario de Email */}
          <form onSubmit={handleEmail} className="flex flex-col gap-4">
            {/* Campo Email */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-email"
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--foreground-muted)" }}
              >
                Email
              </label>
              <div className="relative flex items-center">
                <Mail
                  size={18}
                  className="absolute left-3.5 pointer-events-none"
                  style={{ color: "var(--foreground-subtle)" }}
                />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="estudiante@universidad.edu.ar"
                  className="w-full pl-11 pr-4 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: "var(--background-alt)",
                    border: "1.5px solid var(--color-card-border)",
                    color: "var(--foreground)",
                    outline: "none",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = "var(--color-primary)")
                  }
                  onBlur={(e) =>
                    (e.target.style.borderColor = "var(--color-card-border)")
                  }
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label
                  htmlFor="login-password"
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  Contraseña
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold hover:underline"
                  style={{ color: "var(--color-primary)" }}
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              <div className="relative flex items-center">
                <Lock
                  size={18}
                  className="absolute left-3.5 pointer-events-none"
                  style={{ color: "var(--foreground-subtle)" }}
                />
                <input
                  id="login-password"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-11 pr-12 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: "var(--background-alt)",
                    border: "1.5px solid var(--color-card-border)",
                    color: "var(--foreground)",
                    outline: "none",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = "var(--color-primary)")
                  }
                  onBlur={(e) =>
                    (e.target.style.borderColor = "var(--color-card-border)")
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 p-1 rounded-lg transition-opacity hover:opacity-75"
                  style={{ color: "var(--foreground-subtle)" }}
                  aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Botón Ingresar */}
            <button
              id="btn-login-email"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95 flex items-center justify-center gap-2 mt-1 cursor-pointer"
              style={{
                background: "var(--color-primary)",
                color: "white",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>

          {/* Separador */}
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px" style={{ background: "var(--color-card-border)" }} />
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--foreground-subtle)" }}
            >
              o
            </span>
            <div className="flex-1 h-px" style={{ background: "var(--color-card-border)" }} />
          </div>

          {/* Botón Google */}
          <button
            id="btn-login-google"
            type="button"
            onClick={handleGoogle}
            disabled={loadingGoogle}
            className="w-full py-3 px-4 rounded-xl font-semibold text-sm border transition-all hover:opacity-80 active:scale-95 flex items-center justify-center gap-3 cursor-pointer"
            style={{
              background: "var(--background-alt)",
              borderColor: "var(--color-card-border)",
              color: "var(--foreground)",
            }}
          >
            {loadingGoogle ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Continuar con Google
          </button>

          {/* Enlace a Registro */}
          <p
            className="text-center text-sm font-medium mt-1"
            style={{ color: "var(--foreground-muted)" }}
          >
            ¿No tenés cuenta?{" "}
            <Link
              href="/register"
              className="font-bold hover:underline"
              style={{ color: "var(--color-primary)" }}
            >
              Registrate gratis
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
