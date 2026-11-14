"use client";

// src/components/notas/ConstructorNota.tsx
// Constructor visual de la fórmula de nota final: cada tipo de evaluación
// (parcial, TP, coloquio, final...) se arrastra al grupo que corresponda; cada
// grupo tiene un peso % y una forma de combinar sus notas. Con eso se arma la
// fórmula, sin escribir nada.

import { useMemo, useState } from "react";
import {
  DndContext, useDraggable, useDroppable, DragEndEvent,
  PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, DragOverlay, DragStartEvent,
} from "@dnd-kit/core";
import { Plus, RotateCcw, Trash2, GripVertical, SlidersHorizontal } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Campo, Spinner } from "@/components/ui/kit";
import { useToast } from "@/components/ui/Feedback";
import { GrupoNota, TipoEvaluacion, ConfiguracionNota, Evaluacion, Materia, MetodoGrupo } from "@/types";
import { calcularResultadoMateria, gruposPorDefecto, resolverEvaluacionesEfectivas } from "@/lib/calculo-notas";
import { TIPOS_EVALUACION, formatearNota } from "@/lib/estados";

const TODOS_TIPOS: TipoEvaluacion[] = ["parcial", "recuperatorio", "tp", "coloquio", "final", "otro"];

const METODOS: { value: MetodoGrupo; label: string }[] = [
  { value: "promedio", label: "Promedio de todas" },
  { value: "mejor_nota", label: "La mejor nota" },
  { value: "ultima_nota", label: "La última nota" },
];

const BANCO_ID = "banco";

interface ConstructorNotaProps {
  config: ConfiguracionNota;
  evaluaciones: Evaluacion[];
  onGuardar: (nuevaConfig: ConfiguracionNota) => Promise<void>;
  onCerrar: () => void;
}

function Chip({ tipo, flotando }: { tipo: TipoEvaluacion; flotando?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip-${tipo}`,
    data: { tipo },
  });
  const info = TIPOS_EVALUACION[tipo];
  return (
    <button
      ref={flotando ? undefined : setNodeRef}
      {...(flotando ? {} : listeners)}
      {...(flotando ? {} : attributes)}
      type="button"
      className="inline-flex items-center gap-1 pl-1.5 pr-3 py-1.5 rounded-full text-xs font-bold bg-card border-[1.5px] cursor-grab active:cursor-grabbing touch-none select-none"
      style={{
        color: info.color,
        borderColor: info.color,
        opacity: isDragging && !flotando ? 0.3 : 1,
        boxShadow: flotando ? "var(--shadow-md)" : undefined,
      }}
    >
      <GripVertical size={13} className="opacity-50" />
      {info.label}
    </button>
  );
}

function DropZone({ id, chips, mensajeVacio }: { id: string; chips: TipoEvaluacion[]; mensajeVacio: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className="flex flex-wrap items-center gap-1.5 min-h-[3.25rem] p-2.5 rounded-[var(--radius-md)] border-[1.5px] border-dashed transition-colors"
      style={{
        background: isOver ? "var(--color-primary-soft)" : "var(--background-alt)",
        borderColor: isOver ? "var(--color-primary)" : "var(--color-card-border)",
      }}
    >
      {chips.length === 0 ? (
        <span className="text-xs text-foreground-subtle px-1">{mensajeVacio}</span>
      ) : (
        chips.map((t) => <Chip key={t} tipo={t} />)
      )}
    </div>
  );
}

export function ConstructorNota({ config, evaluaciones, onGuardar, onCerrar }: ConstructorNotaProps) {
  const toast = useToast();
  const [grupos, setGrupos] = useState<GrupoNota[]>(
    config.grupos && config.grupos.length > 0 ? config.grupos : gruposPorDefecto()
  );
  const [notaAprobar, setNotaAprobar] = useState(String(config.nota_aprobar));
  const [notaPromocionar, setNotaPromocionar] = useState(String(config.nota_promocionar));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chipActivo, setChipActivo] = useState<TipoEvaluacion | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const tiposAsignados = new Set(grupos.flatMap((g) => g.tipos));
  const tiposEnBanco = TODOS_TIPOS.filter((t) => !tiposAsignados.has(t));
  const pesoTotal = grupos.reduce((acc, g) => acc + (g.peso || 0), 0);
  const pesoOk = Math.abs(pesoTotal - 100) < 0.01;

  // Las reemplazadas por un recuperatorio no cuentan.
  const efectivas = useMemo(() => resolverEvaluacionesEfectivas(evaluaciones), [evaluaciones]);
  const conNota = efectivas.filter((e) => e.nota !== null && e.nota !== undefined);
  const hayNotas = conNota.length > 0;
  const previewNota = useMemo(
    () =>
      calcularResultadoMateria({
        evaluaciones,
        configuracion_nota: { ...config, sistema: "grupos_ponderados", grupos },
      } as Materia).promedio_actual,
    [evaluaciones, config, grupos]
  );
  // Notas cargadas cuyo tipo no está en ningún grupo: hoy no cuentan.
  const tiposAfuera = Array.from(new Set(conNota.map((e) => e.tipo))).filter((t) => !tiposAsignados.has(t));
  const algunaCuenta = conNota.some((e) => tiposAsignados.has(e.tipo));

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

  function actualizarGrupo(id: string, cambios: Partial<GrupoNota>) {
    setGrupos((prev) => prev.map((g) => (g.id === id ? { ...g, ...cambios } : g)));
  }

  async function handleGuardar() {
    const aprobar = Number(notaAprobar.replace(",", "."));
    const promocionar = Number(notaPromocionar.replace(",", "."));
    if (!(aprobar >= 1 && aprobar <= 10) || !(promocionar >= 1 && promocionar <= 10)) {
      setError("Las notas para aprobar y promocionar tienen que estar entre 1 y 10.");
      return;
    }
    if (promocionar < aprobar) {
      setError("La nota para promocionar no puede ser menor que la de aprobar.");
      return;
    }
    if (!pesoOk) {
      setError(`Los porcentajes suman ${pesoTotal}%. Ajustalos para que den 100%.`);
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await onGuardar({
        ...config,
        sistema: "grupos_ponderados",
        grupos: grupos.map((g) => ({ ...g, nombre: g.nombre.trim() || "Grupo" })),
        nota_aprobar: aprobar,
        nota_promocionar: promocionar,
      });
      toast("Fórmula guardada");
      onCerrar();
    } catch {
      setError("No se pudo guardar. Intentá de nuevo.");
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo="Cómo se calcula tu nota"
      descripcion="Armá grupos, dales un porcentaje y arrastrá adentro los tipos de evaluación que cuentan en cada uno."
      icono={<SlidersHorizontal size={20} />}
      onCerrar={onCerrar}
      ancho="lg"
      pie={
        <>
          <button type="button" className="btn btn-ghost mr-auto" onClick={() => setGrupos(gruposPorDefecto())}
            title="Volver a parciales 50% + TP 20% + final 30%">
            <RotateCcw size={14} /> <span className="hidden sm:inline">Restablecer</span>
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={handleGuardar} disabled={guardando}>
            {guardando && <Spinner size={14} />}
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <div className="notice notice-error" role="alert">{error}</div>}

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="space-y-3">
            {grupos.map((g) => (
              <div key={g.id} className="rounded-[var(--radius-lg)] border border-card-border p-3.5">
                <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                  <input
                    value={g.nombre}
                    onChange={(e) => actualizarGrupo(g.id, { nombre: e.target.value })}
                    className="input input-sm flex-1 min-w-32 font-bold"
                    aria-label="Nombre del grupo"
                    maxLength={40}
                  />
                  <label className="flex items-center gap-1 text-sm font-bold text-foreground-muted">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={g.peso}
                      onChange={(e) => actualizarGrupo(g.id, { peso: Math.max(0, Math.min(100, Number(e.target.value))) })}
                      className="input input-sm no-spin tabular text-center font-bold"
                      style={{ width: "3.75rem" }}
                      aria-label={`Porcentaje de ${g.nombre}`}
                    />
                    %
                  </label>
                  <select
                    value={g.metodo}
                    onChange={(e) => actualizarGrupo(g.id, { metodo: e.target.value as MetodoGrupo })}
                    className="input input-sm"
                    style={{ width: "auto" }}
                    aria-label={`Cómo se combinan las notas de ${g.nombre}`}
                  >
                    {METODOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setGrupos((prev) => prev.filter((x) => x.id !== g.id))}
                    className="icon-btn icon-btn-sm icon-btn-danger"
                    aria-label={`Eliminar grupo ${g.nombre}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <DropZone id={`grupo-${g.id}`} chips={g.tipos} mensajeVacio="Arrastrá acá los tipos de evaluación de este grupo" />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setGrupos((prev) => [
                ...prev,
                { id: `grupo_${Date.now()}`, nombre: "Nuevo grupo", peso: 0, tipos: [], metodo: "promedio" },
              ])
            }
            className="btn btn-secondary btn-block border-dashed"
          >
            <Plus size={15} /> Agregar grupo
          </button>

          <div>
            <p className="label">No cuentan para la nota</p>
            <DropZone id={BANCO_ID} chips={tiposEnBanco} mensajeVacio="Todos los tipos están en algún grupo" />
          </div>

          <DragOverlay>{chipActivo ? <Chip tipo={chipActivo} flotando /> : null}</DragOverlay>
        </DndContext>

        {tiposAfuera.length > 0 && (
          <div className="notice notice-warn">
            <span>
              Tenés notas de tipo{" "}
              <strong>{tiposAfuera.map((t) => TIPOS_EVALUACION[t].label).join(", ")}</strong> que no están en
              ningún grupo.{" "}
              {algunaCuenta
                ? "Así como está, no cuentan para la nota final."
                : "Mientras ninguna nota caiga en un grupo, se promedian todas."}{" "}
              Arrastrá ese tipo a un grupo para que cuente.
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className={`notice ${pesoOk ? "notice-success" : "notice-error"} flex-col !gap-0.5`}>
            <span className="text-xs font-bold opacity-80">Los porcentajes suman</span>
            <span className="font-display tabular text-2xl font-semibold">{pesoTotal}%</span>
            {!pesoOk && <span className="text-xs font-semibold">Tienen que dar 100%</span>}
          </div>
          <div className="notice flex-col !gap-0.5">
            <span className="text-xs font-bold opacity-80">Con tus notas actuales da</span>
            <span className="font-display tabular text-2xl font-semibold text-foreground">
              {hayNotas ? formatearNota(previewNota) : "—"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Nota para aprobar" htmlFor="cn-aprobar">
            <input id="cn-aprobar" className="input tabular" inputMode="decimal" value={notaAprobar}
              onChange={(e) => setNotaAprobar(e.target.value)} />
          </Campo>
          <Campo label="Nota para promocionar" htmlFor="cn-promocionar">
            <input id="cn-promocionar" className="input tabular" inputMode="decimal" value={notaPromocionar}
              onChange={(e) => setNotaPromocionar(e.target.value)} />
          </Campo>
        </div>
      </div>
    </Modal>
  );
}
