"use client";

// src/app/(auth)/forgot-password/page.tsx
// Página para recuperar contraseña mediante email

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { BookOpen, Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setEnviado(true);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/user-not-found" || code === "auth/invalid-email") {
        setError("No encontramos una cuenta con ese email.");
      } else if (code === "auth/too-many-requests") {
        setError("Demasiados intentos. Esperá unos minutos.");
      } else {
        setError("No se pudo enviar el email. Intentá de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {/* Blobs de fondo */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: "var(--color-secondary)", filter: "blur(90px)" }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-15"
          style={{ background: "var(--color-primary)", filter: "blur(90px)" }}
        />
      </div>

      <div
        className="relative w-full max-w-md my-auto animate-fade-in flex flex-col gap-6"
        style={{ zIndex: 1 }}
      >
        {/* Cabecera */}
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
          <p className="text-sm mt-1 font-medium" style={{ color: "var(--foreground-muted)" }}>
            Gestión Académica Inteligente
          </p>
        </div>

        {/* Tarjeta */}
        <div
          className="rounded-2xl p-6 sm:p-8 shadow-xl border flex flex-col gap-5"
          style={{
            background: "var(--color-card)",
            borderColor: "var(--color-card-border)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {!enviado ? (
            <>
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                  Recuperar contraseña
                </h2>
                <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                  Te enviaremos un link para restablecer tu contraseña
                </p>
              </div>

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

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="fp-email"
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    Email de tu cuenta
                  </label>
                  <div className="relative flex items-center">
                    <Mail
                      size={18}
                      className="absolute left-3.5 pointer-events-none"
                      style={{ color: "var(--foreground-subtle)" }}
                    />
                    <input
                      id="fp-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="tu@email.com"
                      className="w-full pl-11 pr-4 py-3 rounded-xl text-sm font-medium transition-all"
                      style={{
                        background: "var(--background-alt)",
                        border: "1.5px solid var(--color-card-border)",
                        color: "var(--foreground)",
                        outline: "none",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                      onBlur={(e) => (e.target.style.borderColor = "var(--color-card-border)")}
                    />
                  </div>
                </div>

                <button
                  id="btn-send-reset"
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
                  {loading ? "Enviando..." : "Enviar link de recuperación"}
                </button>
              </form>
            </>
          ) : (
            /* Estado de éxito */
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "var(--estado-aprobada-bg)" }}
              >
                <CheckCircle2 size={36} style={{ color: "var(--color-success)" }} />
              </div>
              <div>
                <h2 className="text-lg font-bold mb-1" style={{ color: "var(--foreground)" }}>
                  ¡Email enviado!
                </h2>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Revisá tu bandeja de entrada en{" "}
                  <span className="font-bold" style={{ color: "var(--foreground)" }}>
                    {email}
                  </span>
                  . El link expira en 1 hora.
                </p>
              </div>
              <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                Si no lo ves, revisá tu carpeta de spam o correo no deseado.
              </p>
            </div>
          )}

          {/* Link volver */}
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 text-sm font-semibold hover:underline mt-1"
            style={{ color: "var(--color-primary)" }}
          >
            <ArrowLeft size={16} />
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </main>
  );
}
