"use client";

// src/app/(auth)/forgot-password/page.tsx
// Recuperar la contraseña por email.

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { MailCheck } from "lucide-react";
import { auth } from "@/lib/firebase";
import { AuthShell } from "@/components/auth/AuthShell";
import { Spinner } from "@/components/ui/kit";

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
      if (code === "auth/invalid-email") {
        setError("Ese email no parece válido.");
      } else if (code === "auth/too-many-requests") {
        setError("Demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.");
      } else if (code === "auth/user-not-found") {
        // No se confirma si el email tiene cuenta o no: se muestra lo mismo.
        setEnviado(true);
      } else {
        setError("No pudimos enviar el email. Intentá de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (enviado) {
    return (
      <AuthShell titulo="Revisá tu email">
        <div className="flex items-start gap-3">
          <span className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--color-primary-soft)" }}>
            <MailCheck size={20} className="text-primary" />
          </span>
          <p className="text-sm text-foreground-muted">
            Si <strong className="text-foreground break-all">{email.trim()}</strong> tiene una cuenta, le acabamos de mandar
            un link para elegir una contraseña nueva. Puede tardar un par de minutos; mirá también en spam.
          </p>
        </div>
        <Link href="/login" className="btn btn-primary btn-lg btn-block mt-7">Volver a iniciar sesión</Link>
        <button type="button" className="btn btn-ghost btn-block mt-2" onClick={() => setEnviado(false)}>
          Probar con otro email
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell titulo="Recuperá tu contraseña" subtitulo="Escribí el email de tu cuenta y te mandamos un link para elegir una nueva.">
      {error && <div className="notice notice-error mb-4" role="alert">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="fp-email">Email</label>
          <input id="fp-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)}
            required autoComplete="email" placeholder="vos@ejemplo.com" autoFocus />
        </div>
        <button id="btn-send-reset" type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block">
          {loading && <Spinner />}
          {loading ? "Enviando..." : "Enviarme el link"}
        </button>
      </form>

      <p className="text-center text-sm text-foreground-muted mt-6">
        ¿Te acordaste? <Link href="/login" className="link">Volver a iniciar sesión</Link>
      </p>
    </AuthShell>
  );
}
