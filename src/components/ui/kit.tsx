"use client";

// src/components/ui/kit.tsx
// Piezas chicas que usan todas las pantallas. Que existan una sola vez es lo
// que hace que la app se sienta una: mismo encabezado, mismo vacío, misma
// forma de editar una nota en todos lados.

import { ReactNode, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import { EstadoMateria } from "@/types";
import { colorNota, formatearNota, infoEstado, parsearNota } from "@/lib/estados";

// ── Encabezado de página ────────────────────────────────────

interface PageHeaderProps {
  titulo: string;
  subtitulo?: ReactNode;
  /** Link "volver": a dónde y con qué texto */
  volver?: { href: string; label: string };
  acciones?: ReactNode;
}

export function PageHeader({ titulo, subtitulo, volver, acciones }: PageHeaderProps) {
  return (
    <header className="mb-6">
      {volver && (
        <Link
          href={volver.href}
          className="inline-flex items-center gap-0.5 -ml-1 mb-2 text-sm font-semibold text-foreground-muted hover:text-foreground transition-colors"
        >
          <ChevronLeft size={16} /> {volver.label}
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <h1 className="page-title min-w-0">{titulo}</h1>
        {acciones && <div className="flex items-center gap-2 flex-shrink-0">{acciones}</div>}
      </div>
      {subtitulo && <p className="text-sm text-foreground-muted mt-1.5">{subtitulo}</p>}
    </header>
  );
}

// ── Estado vacío ────────────────────────────────────────────

interface EmptyStateProps {
  icono: ReactNode;
  titulo: string;
  texto?: ReactNode;
  children?: ReactNode;
  /** Sin borde ni fondo, para usar adentro de otra tarjeta */
  plano?: boolean;
}

export function EmptyState({ icono, titulo, texto, children, plano }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center text-center px-6 ${
        plano ? "py-8" : "py-12 rounded-[var(--radius-lg)] border-2 border-dashed border-card-border"
      }`}
    >
      <div className="w-12 h-12 rounded-full bg-background-alt flex items-center justify-center text-foreground-subtle mb-3">
        {icono}
      </div>
      <p className="font-bold text-foreground">{titulo}</p>
      {texto && <p className="text-sm text-foreground-muted mt-1 max-w-sm">{texto}</p>}
      {children && <div className="flex flex-wrap items-center justify-center gap-2 mt-5">{children}</div>}
    </div>
  );
}

// ── Spinner y carga ─────────────────────────────────────────

export function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} aria-hidden />;
}

export function PantallaCargando({ texto = "Cargando..." }: { texto?: string }) {
  return (
    <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center gap-3 text-foreground-muted">
      <Spinner size={28} className="text-primary" />
      <p className="text-sm">{texto}</p>
    </div>
  );
}

/** Lista de bloques grises mientras cargan los datos */
export function Esqueleto({ filas = 3, alto = "h-20" }: { filas?: number; alto?: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className={`skeleton ${alto}`} />
      ))}
    </div>
  );
}

// ── Estado de materia ───────────────────────────────────────

export function EstadoBadge({ estado }: { estado: EstadoMateria }) {
  const info = infoEstado(estado);
  return (
    <span className="badge" style={{ background: info.bg, color: info.color }}>
      {info.label}
    </span>
  );
}

// ── Avatar ──────────────────────────────────────────────────

export function Avatar({
  nombre,
  url,
  size = 36,
}: {
  nombre?: string | null;
  url?: string | null;
  size?: number;
}) {
  return (
    <span
      className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 font-bold bg-primary text-primary-fg"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {url ? (
        // Las fotos vienen de Google o de Storage: dominios que next/image no tiene configurados.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        (nombre?.trim()?.[0] ?? "E").toUpperCase()
      )}
    </span>
  );
}

// ── Campo de formulario ─────────────────────────────────────

export function Campo({
  label,
  htmlFor,
  ayuda,
  opcional,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  ayuda?: ReactNode;
  opcional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {opcional && <span className="font-medium text-foreground-subtle"> · opcional</span>}
      </label>
      {children}
      {ayuda && <p className="hint">{ayuda}</p>}
    </div>
  );
}

// ── Nota editable en el lugar ───────────────────────────────

interface NotaEditableProps {
  nota: number | null | undefined;
  /** Nombre de la evaluación, para lectores de pantalla */
  nombre: string;
  aprobar?: number;
  promocionar?: number;
  /** La nota fue reemplazada por un recuperatorio: se muestra tachada */
  anulada?: boolean;
  onGuardar: (nota: number | null) => Promise<void> | void;
}

/**
 * Muestra la nota como botón; al tocarla se convierte en un campo. Enter o
 * salir del campo guarda, Esc cancela, vacío borra la nota. Rechaza valores
 * fuera de 0–10 en vez de guardarlos en silencio.
 */
export function NotaEditable({ nota, nombre, aprobar, promocionar, anulada, onGuardar }: NotaEditableProps) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  const [invalida, setInvalida] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const tieneNota = nota !== null && nota !== undefined;

  function abrir() {
    setValor(tieneNota ? String(nota).replace(".", ",") : "");
    setInvalida(false);
    setEditando(true);
  }

  async function confirmar() {
    const nueva = parsearNota(valor);
    if (Number.isNaN(nueva)) {
      setInvalida(true);
      return;
    }
    setEditando(false);
    if (nueva === (tieneNota ? nota : null)) return;
    setGuardando(true);
    try {
      await onGuardar(nueva);
    } finally {
      setGuardando(false);
    }
  }

  if (editando) {
    return (
      <span className="inline-flex flex-col items-end">
        <input
          autoFocus
          inputMode="decimal"
          value={valor}
          onChange={(e) => { setValor(e.target.value); setInvalida(false); }}
          onFocus={(e) => e.target.select()}
          onBlur={confirmar}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); confirmar(); }
            if (e.key === "Escape") { e.preventDefault(); setEditando(false); }
          }}
          aria-label={`Nota de ${nombre}, de 0 a 10`}
          aria-invalid={invalida}
          placeholder="—"
          className="input input-sm tabular text-center font-bold"
          style={{ width: "4rem" }}
        />
        {invalida && <span className="text-[11px] font-semibold text-alert mt-0.5">De 0 a 10</span>}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={abrir}
      disabled={guardando}
      title={tieneNota ? "Tocá para cambiar la nota" : "Tocá para cargar la nota"}
      aria-label={tieneNota ? `Nota de ${nombre}: ${nota}. Cambiar` : `Cargar nota de ${nombre}`}
      className="tabular inline-flex items-center justify-center min-w-[3.25rem] h-9 px-2.5 rounded-[var(--radius-sm)] border border-card-border bg-card text-sm font-extrabold transition-colors hover:border-primary hover:bg-primary-soft"
      style={{
        color: tieneNota ? colorNota(nota, aprobar, promocionar) : "var(--foreground-subtle)",
        textDecoration: anulada ? "line-through" : undefined,
        opacity: anulada ? 0.6 : 1,
      }}
    >
      {guardando ? <Spinner size={13} /> : tieneNota ? formatearNota(nota) : "+ nota"}
    </button>
  );
}
