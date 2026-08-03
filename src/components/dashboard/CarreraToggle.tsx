"use client";

// src/components/dashboard/CarreraToggle.tsx
// Selector de carrera activa con vista global

import { Carrera } from "@/types";
import { Globe, ChevronDown } from "lucide-react";
import { useState } from "react";

interface CarreraToggleProps {
  carreras: Carrera[];
  carreraActivaId: string | null;
  onChange: (id: string | null) => void;
}

export function CarreraToggle({
  carreras,
  carreraActivaId,
  onChange,
}: CarreraToggleProps) {
  const [open, setOpen] = useState(false);
  const activa = carreras.find((c) => c.id === carreraActivaId);

  if (carreras.length === 0) return null;

  return (
    <div className="relative">
      <button
        id="btn-toggle-carrera"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all hover:opacity-80"
        style={{
          background: "var(--color-card)",
          borderColor: "var(--color-card-border)",
          color: "var(--foreground)",
          boxShadow: "var(--shadow-sm)",
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {activa ? (
          <>
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: activa.color ?? "var(--color-primary)" }}
            />
            <span className="max-w-32 truncate">{activa.nombre}</span>
          </>
        ) : (
          <>
            <Globe size={13} style={{ color: "var(--foreground-muted)" }} />
            <span>Vista global</span>
          </>
        )}
        <ChevronDown
          size={13}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--foreground-subtle)" }}
        />
      </button>

      {open && (
        <div
          className="absolute top-full mt-2 right-0 z-50 rounded-xl border py-1 min-w-48 animate-scale-in"
          style={{
            background: "var(--color-card)",
            borderColor: "var(--color-card-border)",
            boxShadow: "var(--shadow-md)",
          }}
          role="listbox"
        >
          {/* Vista global */}
          <button
            role="option"
            aria-selected={carreraActivaId === null}
            onClick={() => { onChange(null); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-3 transition-colors hover:opacity-75"
            style={{
              color: carreraActivaId === null ? "var(--color-primary)" : "var(--foreground)",
              background: carreraActivaId === null ? "var(--estado-aprobada-bg)" : "transparent",
            }}
          >
            <Globe size={13} />
            Vista global
          </button>

          <div className="h-px mx-3 my-1" style={{ background: "var(--color-card-border)" }} />

          {carreras.map((c) => (
            <button
              key={c.id}
              role="option"
              aria-selected={carreraActivaId === c.id}
              onClick={() => { onChange(c.id); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-3 transition-colors hover:opacity-75"
              style={{
                color: carreraActivaId === c.id ? "var(--color-primary)" : "var(--foreground)",
                background: carreraActivaId === c.id ? "var(--estado-aprobada-bg)" : "transparent",
              }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: c.color ?? "var(--color-primary)" }}
              />
              <span className="truncate">{c.nombre}</span>
              <span className="ml-auto text-xs" style={{ color: "var(--foreground-subtle)" }}>
                {c.institucion}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Overlay para cerrar */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
    </div>
  );
}
