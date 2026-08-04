"use client";

// src/components/notas/ConstructorNota.tsx
// Constructor visual de la fórmula de nota final: arrastrás cada tipo de
// evaluación (parcial, TP, coloquio, final...) al grupo que corresponda,
// cada grupo tiene un peso % y un método para combinar sus notas. Con eso
// se arma la fórmula, sin escribir nada.

import { useMemo, useState } from "react";
import {
  DndContext, useDraggable, useDroppable, DragEndEvent,
  PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay, DragStartEvent,
} from "@dnd-kit/core";
import {
  X, Plus, RotateCcw, Trash2, Loader2, Sparkles, GripVertical,
} from "lucide-react";
import { GrupoNota, TipoEvaluacion, ConfiguracionNota, Evaluacion, MetodoGrupo } from "@/types";
import { calcularNotaGrupos, gruposPorDefecto } from "@/lib/calculo-notas";

const TIPOS_INFO: Record<TipoEvaluacion, { label: string; color: string }> = {
  parcial: { label: "Parcial", color: "#2196a3" },
  recuperatorio: { label: "Recuperatorio", color: "#8b5cf6" },
  tp: { label: "Trabajo práctico", color: "#059669" },
  coloquio: { label: "Coloquio", color: "#d4a017" },
  final: { label: "Final", color: "#52796f" },
  otro: { label: "Otro", color: "#64748b" },
};

const TODOS_TIPOS: TipoEvaluacion[] = ["parcial", "recuperatorio", "tp", "coloquio", "final", "otro"];

const METODOS: { value: MetodoGrupo; label: string }[] = [
  { value: "promedio", label: "Promedio" },
  { value: "mejor_nota", label: "Mejor nota" },
  { value: "ultima_nota", label: "Última nota" },
];

const BANCO_ID = "banco";

interface ConstructorNotaProps {
  config: ConfiguracionNota;
  evaluaciones: Evaluacion[];
  onGuardar: (nuevaConfig: ConfiguracionNota) => Promise<void>;
  onCerrar: () => void;
}

function Chip({ tipo }: { tipo: TipoEvaluacion }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip-${tipo}`,
    data: { tipo },
  });
  const info = TIPOS_INFO[tipo];
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold cursor-grab active:cursor-grabbing touch-none select-none transition-opacity"
      style={{
        background: info.color + "26",
        color: info.color,
        border: `1.5px solid ${info.color}55`,
        opacity: isDragging ? 0.3 : 1,
      }}
    >
      <GripVertical size={11} style={{ opacity: 0.5 }} />
      {info.label}
    </button>
  );
}

function DropZone({ id, chips, mensajeVacio }: { id: string; chips: TipoEvaluacion[]; mensajeVacio: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className="flex flex-wrap gap-1.5 min-h-12 p-2.5 rounded-xl transition-colors"
      style={{
        background: isOver ? "var(--estado-aprobada-bg)" : "var(--background-alt)",
        border: `1.5px dashed ${isOver ? "var(--estado-aprobada)" : "var(--color-card-border)"}`,
      }}
    >
      {chips.length === 0 ? (
        <span className="text-xs px-1 py-1.5" style={{ color: "var(--foreground-subtle)" }}>
          {mensajeVacio}
        </span>
      ) : (
        chips.map((t) => <Chip key={t} tipo={t} />)
      )}
    </div>
  );
}

export function ConstructorNota({ config, evaluaciones, onGuardar, onCerrar }: ConstructorNotaProps) {
  const [grupos, setGrupos] = useState<GrupoNota[]>(
    config.grupos && config.grupos.length > 0 ? config.grupos : gruposPorDefecto()
  );
  const [notaAprobar, setNotaAprobar] = useState(config.nota_aprobar);
  const [notaPromocionar, setNotaPromocionar] = useState(config.nota_promocionar);
  const [guardando, setGuardando] = useState(false);
  const [chipActivo, setChipActivo] = useState<TipoEvaluacion | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  );

  const tiposAsignados = new Set(grupos.flatMap((g) => g.tipos));
  const tiposEnBanco = TODOS_TIPOS.filter((t) => !tiposAsignados.has(t));
  const pesoTotal = grupos.reduce((acc, g) => acc + (g.peso || 0), 0);
  const pesoOk = Math.abs(pesoTotal - 100) < 0.01;

  const previewNota = useMemo(() => calcularNotaGrupos(evaluaciones, grupos), [evaluaciones, grupos]);
  const hayNotasCargadas = evaluaciones.some((e) => e.nota !== null && e.nota !== undefined);

  function handleDragStart(e: DragStartEvent) {
    setChipActivo((e.active.data.current?.tipo as TipoEvaluacion) ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setChipActivo(null);
    const { active, over } = e;
    if (!over) return;
    const tipo = active.data.current?.tipo as TipoEvaluacion;
    const destino = String(over.id);

    setGrupos((prev) => {
      const sinTipo = prev.map((g) => ({ ...g, tipos: g.tipos.filter((t) => t !== tipo) }));
      if (destino === BANCO_ID) return sinTipo;
      return sinTipo.map((g) => (`grupo-${g.id}` === destino ? { ...g, tipos: [...g.tipos, tipo] } : g));
    });
  }

  function agregarGrupo() {
    setGrupos((prev) => [
      ...prev,
      { id: `grupo_${Date.now()}`, nombre: "Nuevo grupo", peso: 0, tipos: [], metodo: "promedio" },
    ]);
  }

  function eliminarGrupo(id: string) {
    setGrupos((prev) => prev.filter((g) => g.id !== id));
  }

  function actualizarGrupo(id: string, cambios: Partial<GrupoNota>) {
    setGrupos((prev) => prev.map((g) => (g.id === id ? { ...g, ...cambios } : g)));
  }

  function restaurarDefault() {
    setGrupos(gruposPorDefecto());
  }

  async function handleGuardar() {
    setGuardando(true);
    try {
      await onGuardar({
        ...config,
        sistema: "grupos_ponderados",
        grupos,
        nota_aprobar: notaAprobar,
        nota_promocionar: notaPromocionar,
      });
      onCerrar();
    } finally {
      setGuardando(false);
    }
  }

  const inputStyle = {
    background: "var(--color-card)",
    border: "1.5px solid var(--color-card-border)",
    color: "var(--foreground)",
    outline: "none",
    borderRadius: "var(--radius-md)",
    padding: "0.4rem 0.6rem",
    fontSize: "var(--font-size-sm)",
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-2xl overflow-hidden animate-fade-in"
        style={{ background: "var(--color-card)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--color-card-border)" }}>
          <div>
            <h2 className="font-bold text-base flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Sparkles size={16} style={{ color: "var(--color-primary)" }} />
              Cómo se calcula tu nota
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>
              Arrastrá cada tipo de evaluación al grupo que corresponda
            </p>
          </div>
          <button onClick={onCerrar} className="p-2 rounded-xl hover:opacity-70 transition-opacity flex-shrink-0"
            style={{ color: "var(--foreground-muted)" }} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

            {/* Banco de tipos sin asignar */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                Sin asignar
              </p>
              <DropZone id={BANCO_ID} chips={tiposEnBanco} mensajeVacio="Todos los tipos están asignados a un grupo" />
            </div>

            {/* Grupos */}
            <div className="space-y-3">
              {grupos.map((g) => (
                <div key={g.id} className="rounded-2xl p-3.5 border" style={{ borderColor: "var(--color-card-border)" }}>
                  <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                    <input
                      value={g.nombre}
                      onChange={(e) => actualizarGrupo(g.id, { nombre: e.target.value })}
                      className="font-bold text-sm flex-1 min-w-24 bg-transparent outline-none"
                      style={{ color: "var(--foreground)" }}
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={g.peso}
                        onChange={(e) => actualizarGrupo(g.id, { peso: Number(e.target.value) })}
                        style={{ ...inputStyle, width: "3.5rem", textAlign: "center" }}
                      />
                      <span className="text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>%</span>
                    </div>
                    <select
                      value={g.metodo}
                      onChange={(e) => actualizarGrupo(g.id, { metodo: e.target.value as MetodoGrupo })}
                      style={{ ...inputStyle, fontSize: "11px", padding: "0.4rem" }}
                    >
                      {METODOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <button onClick={() => eliminarGrupo(g.id)}
                      className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                      style={{ color: "var(--color-alert)" }} aria-label={`Eliminar grupo ${g.nombre}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <DropZone id={`grupo-${g.id}`} chips={g.tipos} mensajeVacio="Arrastrá acá tipos de evaluación" />
                </div>
              ))}
            </div>

            <DragOverlay>
              {chipActivo ? <Chip tipo={chipActivo} /> : null}
            </DragOverlay>
          </DndContext>

          <button onClick={agregarGrupo}
            className="w-full py-2.5 rounded-xl text-sm font-semibold border-2 border-dashed transition-all hover:opacity-75 flex items-center justify-center gap-1.5"
            style={{ borderColor: "var(--color-card-border)", color: "var(--foreground-muted)" }}>
            <Plus size={14} /> Agregar grupo
          </button>

          {/* Suma de pesos */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>
              Suma de pesos
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                background: pesoOk ? "var(--estado-aprobada-bg)" : "var(--estado-libre-bg)",
                color: pesoOk ? "var(--estado-aprobada)" : "var(--color-alert)",
              }}>
              {pesoTotal}% {pesoOk ? "✓" : `(debería ser 100%)`}
            </span>
          </div>

          {/* Vista previa */}
          <div className="rounded-xl p-3.5" style={{ background: "var(--background-alt)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--foreground-muted)" }}>
              Vista previa con tus notas actuales
            </p>
            <p className="text-2xl font-extrabold" style={{ color: hayNotasCargadas ? "var(--color-primary)" : "var(--foreground-subtle)" }}>
              {hayNotasCargadas ? previewNota.toFixed(2) : "—"}
            </p>
          </div>

          {/* Umbrales */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                Nota para aprobar
              </label>
              <input type="number" min={1} max={10} step={0.5} value={notaAprobar}
                onChange={(e) => setNotaAprobar(Number(e.target.value))}
                style={{ ...inputStyle, width: "100%" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                Nota para promocionar
              </label>
              <input type="number" min={1} max={10} step={0.5} value={notaPromocionar}
                onChange={(e) => setNotaPromocionar(Number(e.target.value))}
                style={{ ...inputStyle, width: "100%" }} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t flex-shrink-0"
          style={{ borderColor: "var(--color-card-border)" }}>
          <button onClick={restaurarDefault}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all hover:opacity-75"
            style={{ borderColor: "var(--color-card-border)", color: "var(--foreground-muted)" }}>
            <RotateCcw size={13} /> <span className="hidden sm:inline">Restaurar</span>
          </button>
          <div className="flex-1" />
          <button onClick={onCerrar}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all hover:opacity-75"
            style={{ borderColor: "var(--color-card-border)", color: "var(--foreground-muted)" }}>
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={guardando}
            className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 flex items-center gap-2"
            style={{ background: "var(--color-primary)", color: "white" }}>
            {guardando && <Loader2 size={14} className="animate-spin" />}
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
