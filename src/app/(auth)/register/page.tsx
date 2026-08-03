"use client";

// src/app/(auth)/register/page.tsx
// Página de registro de nueva cuenta de Monteflori

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { crearPerfilUsuario } from "@/lib/firestore";
import { BookOpen, Mail, Lock, User, Eye, EyeOff, Loader2, GraduationCap } from "lucide-react";

const provider = new GoogleAuthProvider();

/** Calcula la fortaleza de una contraseña de 0 a 4 */
function calcularFortaleza(password: string): { score: number; label: string; color: string } {
  if (password.length === 0) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const niveles: { label: string; color: string }[] = [
    { label: "Muy débil", color: "#ef4444" },
    { label: "Débil", color: "#f97316" },
    { label: "Regular", color: "#eab308" },
    { label: "Fuerte", color: "#22c55e" },
    { label: "Muy fuerte", color: "#10b981" },
  ];

  return { score, ...niveles[score] };
}

export default function RegisterPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [universidad, setUniversidad] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showPassConfirm, setShowPassConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fortaleza = calcularFortaleza(password);
  const passwordsCoinciden = password === passwordConfirm;

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (!passwordsCoinciden) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: nombre });
      await crearPerfilUsuario(cred.user.uid, nombre, email, universidad.trim() || undefined);
      router.push("/");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/email-already-in-use") {
        setError("Ya existe una cuenta con ese email.");
      } else if (code === "auth/weak-password") {
        setError("La contraseña es demasiado débil.");
      } else {
        setError("Error al crear la cuenta. Intentá de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoadingGoogle(true);
    try {
      const cred = await signInWithPopup(auth, provider);
      await crearPerfilUsuario(
        cred.user.uid,
        cred.user.displayName ?? "Estudiante",
        cred.user.email ?? ""
      );
      router.push("/");
    } catch {
      setError("No se pudo registrar con Google.");
    } finally {
      setLoadingGoogle(false);
    }
  }

  const inputStyle = {
    background: "var(--background-alt)",
    border: "1.5px solid var(--color-card-border)",
    color: "var(--foreground)",
    outline: "none",
  };

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: "var(--color-accent)", filter: "blur(90px)" }} />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-15"
          style={{ background: "var(--color-primary)", filter: "blur(90px)" }} />
      </div>

      <div className="relative w-full max-w-md my-auto animate-fade-in flex flex-col gap-6" style={{ zIndex: 1 }}>
        {/* Cabecera */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-md transition-transform hover:scale-105"
            style={{ background: "var(--color-primary)" }}>
            <BookOpen size={28} color="white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "var(--foreground)" }}>
            Crear cuenta
          </h1>
          <p className="text-sm mt-1 font-medium" style={{ color: "var(--foreground-muted)" }}>
            Empezá a gestionar tu carrera académica hoy
          </p>
        </div>

        <div className="rounded-2xl p-6 sm:p-8 shadow-xl border flex flex-col gap-5"
          style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)", boxShadow: "var(--shadow-md)" }}>

          {error && (
            <div className="p-3.5 rounded-xl text-xs font-semibold animate-fade-in flex items-center gap-2"
              style={{ background: "var(--estado-libre-bg)", color: "var(--color-alert)", border: "1px solid var(--color-alert-light)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            {/* Nombre */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-nombre" className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--foreground-muted)" }}>
                Nombre completo *
              </label>
              <div className="relative flex items-center">
                <User size={18} className="absolute left-3.5 pointer-events-none"
                  style={{ color: "var(--foreground-subtle)" }} />
                <input id="reg-nombre" type="text" value={nombre}
                  onChange={(e) => setNombre(e.target.value)} required
                  placeholder="Juan Pérez"
                  className="w-full pl-11 pr-4 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{ ...inputStyle }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-card-border)")} />
              </div>
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-email" className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--foreground-muted)" }}>
                Email *
              </label>
              <div className="relative flex items-center">
                <Mail size={18} className="absolute left-3.5 pointer-events-none"
                  style={{ color: "var(--foreground-subtle)" }} />
                <input id="reg-email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} required
                  placeholder="tu@email.com"
                  className="w-full pl-11 pr-4 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{ ...inputStyle }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-card-border)")} />
              </div>
            </div>

            {/* Universidad */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-universidad" className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--foreground-muted)" }}>
                Universidad / Institución <span style={{ color: "var(--foreground-subtle)", fontWeight: 400, textTransform: "none" }}>(opcional)</span>
              </label>
              <div className="relative flex items-center">
                <GraduationCap size={18} className="absolute left-3.5 pointer-events-none"
                  style={{ color: "var(--foreground-subtle)" }} />
                <input id="reg-universidad" type="text" value={universidad}
                  onChange={(e) => setUniversidad(e.target.value)}
                  placeholder="Ej: UTN, UBA, UNC..."
                  className="w-full pl-11 pr-4 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{ ...inputStyle }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-card-border)")} />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-password" className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--foreground-muted)" }}>
                Contraseña *
              </label>
              <div className="relative flex items-center">
                <Lock size={18} className="absolute left-3.5 pointer-events-none"
                  style={{ color: "var(--foreground-subtle)" }} />
                <input id="reg-password" type={showPass ? "text" : "password"}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  required placeholder="Mínimo 6 caracteres"
                  className="w-full pl-11 pr-12 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{ ...inputStyle }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-card-border)")} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 p-1 rounded-lg transition-opacity hover:opacity-75"
                  style={{ color: "var(--foreground-subtle)" }}
                  aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {/* Indicador de fortaleza */}
              {password.length > 0 && (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="flex-1 h-1.5 rounded-full transition-all duration-300"
                        style={{
                          background: i < fortaleza.score ? fortaleza.color : "var(--color-card-border)",
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-xs font-semibold" style={{ color: fortaleza.color }}>
                    {fortaleza.label}
                    {fortaleza.score < 3 && " · Usá mayúsculas, números y símbolos"}
                  </p>
                </div>
              )}
            </div>

            {/* Confirmar Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-password-confirm" className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--foreground-muted)" }}>
                Confirmar contraseña *
              </label>
              <div className="relative flex items-center">
                <Lock size={18} className="absolute left-3.5 pointer-events-none"
                  style={{ color: "var(--foreground-subtle)" }} />
                <input id="reg-password-confirm" type={showPassConfirm ? "text" : "password"}
                  value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)}
                  required placeholder="Repetí la contraseña"
                  className="w-full pl-11 pr-12 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{
                    ...inputStyle,
                    borderColor: passwordConfirm.length > 0
                      ? (passwordsCoinciden ? "var(--color-success)" : "var(--color-alert)")
                      : "var(--color-card-border)",
                  }}
                  onFocus={(e) => {
                    if (passwordConfirm.length === 0) e.target.style.borderColor = "var(--color-primary)";
                  }}
                  onBlur={(e) => {
                    if (passwordConfirm.length === 0) e.target.style.borderColor = "var(--color-card-border)";
                  }}
                />
                <button type="button" onClick={() => setShowPassConfirm(!showPassConfirm)}
                  className="absolute right-3.5 p-1 rounded-lg transition-opacity hover:opacity-75"
                  style={{ color: "var(--foreground-subtle)" }}
                  aria-label={showPassConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  {showPassConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordConfirm.length > 0 && !passwordsCoinciden && (
                <p className="text-xs font-semibold mt-0.5" style={{ color: "var(--color-alert)" }}>
                  Las contraseñas no coinciden
                </p>
              )}
            </div>

            <button id="btn-register-email" type="submit"
              disabled={loading || !passwordsCoinciden}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95 flex items-center justify-center gap-2 mt-1 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: "var(--color-primary)", color: "white", boxShadow: "var(--shadow-sm)" }}>
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>

            <p className="text-xs text-center" style={{ color: "var(--foreground-subtle)" }}>
              Al registrarte, aceptás el uso de tus datos para la gestión académica.
            </p>
          </form>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px" style={{ background: "var(--color-card-border)" }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-subtle)" }}>o</span>
            <div className="flex-1 h-px" style={{ background: "var(--color-card-border)" }} />
          </div>

          <button id="btn-register-google" type="button" onClick={handleGoogle} disabled={loadingGoogle}
            className="w-full py-3 px-4 rounded-xl font-semibold text-sm border transition-all hover:opacity-80 active:scale-95 flex items-center justify-center gap-3 cursor-pointer"
            style={{ background: "var(--background-alt)", borderColor: "var(--color-card-border)", color: "var(--foreground)" }}>
            {loadingGoogle ? <Loader2 size={18} className="animate-spin" /> : (
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Continuar con Google
          </button>

          <p className="text-center text-sm font-medium mt-1" style={{ color: "var(--foreground-muted)" }}>
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="font-bold hover:underline" style={{ color: "var(--color-primary)" }}>
              Iniciá sesión
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
