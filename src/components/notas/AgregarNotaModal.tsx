"use client";

// src/components/notas/AgregarNotaModal.tsx
// Modal compartido para cargar una nota: se usa desde el home (eligiendo
// materia) y desde el detalle de materia (con la materia ya fija). Si el
// tipo es "recuperatorio", permite vincularlo a la evaluación que recupera
// — esa evaluación no se borra, pero queda afuera del cálculo de la nota
// final (la reemplaza el recuperatorio).

import { useEffect, useState } from "react";
import { X, Loader2, Award, AlertCircle } from "lucide-react";
import { Materia, Evaluacion, TipoEvaluacion } from "@/types";

const TIPO_LABEL: Record<TipoEvaluacion, string> = {
  parcial: "Parcial",
  recuperatorio: "Recuperatorio",
  tp: "Trabajo práctico",
  coloquio: "Coloquio",
  final: "Final",
  otro: "Otro",
};

const TIPOS_ORDEN: TipoEvaluacion[] = ["parcial", "tp", "coloquio", "final", "recuperatorio", "otro"];

interface AgregarNotaModalProps {
  materias: Materia[];
  /** Si se pasa, la materia queda fija (no se muestra el selector) */
  materiaIdInicial?: string;
  onGuardar: (materiaId: string, datos: Omit<Evaluacion, "id">) => Promise<void>;
  onCerrar: () => void;
}

export function AgregarNotaModal({ materias, materiaIdInicial, onGuardar, onCerrar }: AgregarNotaModalProps) {
  const [materiaId, setMateriaId] = useState(materiaIdInicial ?? "");
  const [tipo, setTipo] = useState<TipoEvaluacion>("parcial");
  const [nombre, setNombre] = useState("");
  const [nombreTocado, setNombreTocado] = useState(false);
  const [nota, setNota] = useState<number | "">("");
  const [recuperaDeId, setRecuperaDeId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const materiaSeleccionada = materias.find((m) => m.id === materiaId) ?? null;
  const evaluacionesExistentes = materiaSeleccionada?.evaluaciones ?? [];
  const candidatasARecuperar = evaluacionesExistentes.filter((e) => e.tipo !== "recuperatorio");

  // Sugiere un nombre ("Parcial 2") mientras el usuario no haya escrito el propio.
  useEffect(() => {
    if (nombreTocado) return;
    const cantidad = evaluacionesExistentes.filter((e) => e.tipo === tipo).length + 1;
    setNombre(`${TIPO_LABEL[tipo]} ${cantidad}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, materiaId]);

  // Si cambia de tipo y ya no es recuperatorio, olvidamos el vínculo elegido.
  useEffect(() => {
    if (tipo !== "recuperatorio") setRecuperaDeId("");
  }, [tipo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!materiaId) { setError("Elegí a qué materia corresponde."); return; }
    if (!nombre.trim()) { setError("Ponele un nombre a la evaluación."); return; }
    setError(null);
    setGuardando(true);
    try {
      await onGuardar(materiaId, {
        nombre: nombre.trim(),
        tipo,
        nota: nota === "" ? null : Number(nota),
        recuperatorio_de: tipo === "recuperatorio" && recuperaDeId ? recuperaDeId : undefined,
      });
      onCerrar();
    } catch {
      setError("No se pudo guardar. Intentá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const inputStyle = {
    background: "var(--background-alt)",
    border: "1.5px solid var(--color-card-border)",
    color: "var(--foreground)",
    outline: "none",
    borderRadius: "var(--radius-md)",
    padding: "0.625rem 0.875rem",
    fontSize: "var(--font-size-sm)",
    width: "100%",
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full sm:max-w-md max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl overflow-hidden animate-fade-in"
        style={{ background: "var(--color-card)" }}>

        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--color-card-border)" }}>
          <h2 className="font-bold text-base flex items-center gap-2" style={{ color: "var(--foreground)" }}>
            <Award size={16} style={{ color: "var(--color-primary)" }} />
            Cargar nota
          </h2>
          <button onClick={onCerrar} className="p-2 rounded-xl hover:opacity-70 transition-opacity"
            style={{ color: "var(--foreground-muted)" }} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl flex items-center gap-2 text-sm font-medium"
              style={{ background: "var(--estado-libre-bg)", color: "var(--color-alert)" }}>
              <AlertCircle size={16} className="flex-shrink-0" /> {error}
            </div>
          )}

          {!materiaIdInicial ? (
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                Materia
              </label>
              <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)}
                required autoFocus style={inputStyle}>
                <option value="">Elegí una materia</option>
                {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>
          ) : (
            materiaSeleccionada && (
              <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                {materiaSeleccionada.nombre}
              </p>
            )
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                Tipo
              </label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoEvaluacion)} style={inputStyle}>
                {TIPOS_ORDEN.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                Nota (opcional)
              </label>
              <input type="number" min={0} max={10} step={0.5} value={nota}
                onChange={(e) => setNota(e.target.value ? Number(e.target.value) : "")}
                placeholder="—" style={inputStyle} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
              Nombre
            </label>
            <input value={nombre} onChange={(e) => { setNombre(e.target.value); setNombreTocado(true); }}
              required style={inputStyle} />
          </div>

          {tipo === "recuperatorio" && (
            <div className="p-3 rounded-xl" style={{ background: "var(--background-alt)" }}>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                ¿Qué evaluación recupera? (opcional)
              </label>
              {candidatasARecuperar.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                  Todavía no hay otras evaluaciones cargadas en esta materia para vincular.
                </p>
              ) : (
                <>
                  <select value={recuperaDeId} onChange={(e) => setRecuperaDeId(e.target.value)}
                    style={{ ...inputStyle, background: "var(--color-card)" }}>
                    <option value="">No recupera ninguna en particular</option>
                    {candidatasARecuperar.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.nombre} {ev.nota !== null && ev.nota !== undefined ? `(nota: ${ev.nota})` : "(sin nota)"}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs mt-1.5" style={{ color: "var(--foreground-subtle)" }}>
                    No se borra la nota original — queda en tu historial, pero para calcular tu nota final se usa esta.
                  </p>
                </>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onCerrar}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all hover:opacity-75"
              style={{ borderColor: "var(--color-card-border)", color: "var(--foreground-muted)" }}>
              Cancelar
            </button>
            <button type="submit" disabled={guardando || !materiaId}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 flex items-center justify-center gap-2"
              style={{ background: "var(--color-primary)", color: "white" }}>
              {guardando && <Loader2 size={14} className="animate-spin" />}
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
