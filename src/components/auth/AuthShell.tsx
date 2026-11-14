"use client";

// src/components/auth/AuthShell.tsx
// Marco común de las pantallas de acceso (entrar, crear cuenta, recuperar
// contraseña): a la izquierda qué es Monteflori, a la derecha el formulario.
// En celular queda solo el formulario con el logo arriba.
//
// También se ocupa de que alguien que ya tiene sesión no vea el login: lo
// manda directo al inicio.

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CalendarDays, GraduationCap, Route } from "lucide-react";
import { useAuthContext } from "./AuthProvider";
import { Spinner } from "@/components/ui/kit";

const PUNTOS = [
  { icon: GraduationCap, texto: "Sabé cuánto te falta para recibirte, materia por materia." },
  { icon: Route, texto: "Mirá qué podés cursar ahora según tus correlativas." },
  { icon: CalendarDays, texto: "Tené parciales y finales a la vista, y en el calendario que uses." },
];

export function AuthShell({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  const { user, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);

  return (
    <main className="flex-1 min-h-screen grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Panel de marca — solo escritorio */}
      <aside
        className="hidden lg:flex flex-col justify-between p-12 xl:p-16 relative overflow-hidden"
        style={{ background: "var(--background-alt)" }}
      >
        <div aria-hidden className="absolute -bottom-32 -left-24 w-[28rem] h-[28rem] rounded-full opacity-40"
          style={{ background: "var(--color-primary-light)", filter: "blur(90px)" }} />
        <div aria-hidden className="absolute -top-24 -right-24 w-80 h-80 rounded-full opacity-30"
          style={{ background: "var(--color-accent-light)", filter: "blur(90px)" }} />

        <div className="relative flex items-center gap-3">
          <Image src="/logo.png" alt="" width={44} height={44} className="rounded-xl" priority />
          <span className="font-display text-2xl font-semibold text-foreground">Monteflori</span>
        </div>

        <div className="relative max-w-md">
          <p className="font-display text-5xl xl:text-6xl font-semibold text-foreground leading-[1.05] tracking-tight">
            Tu carrera,<br />clara.
          </p>
          <ul className="mt-10 space-y-5">
            {PUNTOS.map(({ icon: Icon, texto }) => (
              <li key={texto} className="flex items-start gap-3.5 text-foreground-muted">
                <span className="w-9 h-9 rounded-full bg-card flex items-center justify-center flex-shrink-0 text-primary"
                  style={{ boxShadow: "var(--shadow-sm)" }}>
                  <Icon size={17} />
                </span>
                <span className="pt-1.5 text-[15px] leading-snug">{texto}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-foreground-subtle">Gratis, hecho por y para estudiantes.</p>
      </aside>

      <section className="flex flex-col items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <Image src="/logo.png" alt="" width={40} height={40} className="rounded-xl" priority />
            <span className="font-display text-2xl font-semibold text-foreground">Monteflori</span>
          </div>

          <h1 className="page-title">{titulo}</h1>
          {subtitulo && <p className="text-sm text-foreground-muted mt-2">{subtitulo}</p>}

          <div className="mt-7">
            {loading || user ? (
              <div className="flex justify-center py-10"><Spinner size={24} className="text-primary" /></div>
            ) : (
              children
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

/** Separador "o" entre el formulario y el botón de Google */
export function Separador() {
  return (
    <div className="flex items-center gap-3 my-5" role="separator">
      <span className="flex-1 h-px bg-card-border" />
      <span className="text-xs font-bold text-foreground-subtle">o</span>
      <span className="flex-1 h-px bg-card-border" />
    </div>
  );
}

export function BotonGoogle({ id, onClick, cargando, children }: {
  id?: string; onClick: () => void; cargando: boolean; children: ReactNode;
}) {
  return (
    <button id={id} type="button" onClick={onClick} disabled={cargando} className="btn btn-secondary btn-lg btn-block">
      {cargando ? (
        <Spinner />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      )}
      {children}
    </button>
  );
}

/** Campo de contraseña con botón para verla */
export function CampoPassword({
  id, value, onChange, autoComplete, placeholder, mostrar, onAlternar,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  mostrar: boolean;
  onAlternar: () => void;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={mostrar ? "text" : "password"}
        className="input !pr-20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
      />
      <button
        type="button"
        onClick={onAlternar}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 btn btn-ghost btn-sm"
        aria-pressed={mostrar}
        aria-controls={id}
      >
        {mostrar ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}
