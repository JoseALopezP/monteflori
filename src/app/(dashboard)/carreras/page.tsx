"use client";

// src/app/(dashboard)/carreras/page.tsx
// Carreras del usuario: crear, editar, eliminar y elegir cuál se está mirando.

import { useState } from "react";
import { Building2, Check, Eye, GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useCarreraActivaContext } from "@/components/dashboard/CarreraActivaProvider";
import { useMaterias } from "@/hooks/useMaterias";
import { useConfirm, useToast } from "@/components/ui/Feedback";
import { Modal } from "@/components/ui/Modal";
import { Campo, EmptyState, Esqueleto, PageHeader, Spinner } from "@/components/ui/kit";
import { addCarrera, deleteCarrera, updateCarrera } from "@/lib/firestore";
import { calcularPorcentajeAvance, calcularPromedioGeneral } from "@/lib/calculo-notas";
import { COLORES_CARRERA, formatearNota } from "@/lib/estados";
import { Carrera } from "@/types";
import { deleteField } from "firebase/firestore";

const COLORES = COLORES_CARRERA;

export default function CarrerasPage() {
  const { user } = useAuthContext();
  const toast = useToast();
  const confirmar = useConfirm();
  const { carreras, loading, carreraActivaId, setCarreraActivaId } = useCarreraActivaContext();
  const { materias } = useMaterias();

  // undefined = cerrado, null = creando, Carrera = editando
  const [editando, setEditando] = useState<Carrera | null | undefined>(undefined);

  async function eliminar(carrera: Carrera) {
    if (!user) return;
    const cantidad = materias.filter((m) => m.carreras_vinculadas?.includes(carrera.id)).length;
    const ok = await confirmar({
      titulo: `¿Eliminar ${carrera.nombre}?`,
      mensaje:
        cantidad > 0
          ? `Sus ${cantidad} materias no se borran: quedan en tu lista, sin carrera.`
          : "No tiene materias vinculadas.",
      accion: "Eliminar carrera",
    });
    if (!ok) return;
    try {
      await deleteCarrera(user.uid, carrera.id, materias);
      if (carreraActivaId === carrera.id) setCarreraActivaId(null);
      toast("Carrera eliminada");
    } catch {
      toast("No se pudo eliminar la carrera", "error");
    }
  }

  return (
    <main className="page page-narrow">
      <PageHeader
        titulo="Mis carreras"
        subtitulo="Cada materia puede pertenecer a una o más carreras. Elegí cuál mirar desde el selector de arriba."
        acciones={
          <button id="btn-nueva-carrera" type="button" className="btn btn-primary" onClick={() => setEditando(null)}>
            <Plus size={16} /> Nueva carrera
          </button>
        }
      />

      {loading ? (
        <Esqueleto filas={2} alto="h-36" />
      ) : carreras.length === 0 ? (
        <EmptyState
          icono={<GraduationCap size={22} />}
          titulo="Todavía no tenés carreras"
          texto="Creá tu carrera para ver cuánto te falta para recibirte. Si traés tus materias de SIU Guaraní, se crea sola."
        >
          <button type="button" className="btn btn-primary" onClick={() => setEditando(null)}>
            <Plus size={16} /> Crear mi carrera
          </button>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {carreras.map((carrera) => {
            const suyas = materias.filter((m) => m.carreras_vinculadas?.includes(carrera.id));
            const aprobadas = suyas.filter((m) => m.estado === "aprobada").length;
            const total = carrera.total_materias_plan ?? suyas.length;
            const porcentaje = Math.min(100, calcularPorcentajeAvance(suyas, carrera.total_materias_plan));
            const promedio = calcularPromedioGeneral(suyas);
            const activa = carreraActivaId === carrera.id;
            const color = carrera.color ?? "var(--color-primary)";

            return (
              <article key={carrera.id} className="card card-pad">
                <div className="flex items-start gap-3">
                  <span className="w-3 h-3 rounded-full flex-shrink-0 mt-1.5" style={{ background: color }} aria-hidden />
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-foreground leading-snug">{carrera.nombre}</h2>
                    {carrera.institucion && (
                      <p className="text-sm text-foreground-muted flex items-center gap-1.5 mt-0.5">
                        <Building2 size={13} /> {carrera.institucion}
                      </p>
                    )}
                  </div>
                  <button type="button" className="icon-btn icon-btn-sm" onClick={() => setEditando(carrera)} aria-label={`Editar ${carrera.nombre}`}>
                    <Pencil size={15} />
                  </button>
                  <button type="button" className="icon-btn icon-btn-sm icon-btn-danger" onClick={() => eliminar(carrera)} aria-label={`Eliminar ${carrera.nombre}`}>
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="mt-4">
                  <div className="flex items-baseline justify-between text-sm mb-1.5">
                    <span className="text-foreground-muted">
                      <strong className="text-foreground tabular">{aprobadas}</strong> de{" "}
                      <strong className="text-foreground tabular">{total}</strong> materias aprobadas
                    </span>
                    <span className="font-display tabular text-lg font-semibold text-foreground">{porcentaje}%</span>
                  </div>
                  <div className="progress" role="progressbar" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ width: `${porcentaje}%`, background: color }} />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
                  <p className="text-xs text-foreground-subtle">
                    {promedio > 0 ? `Promedio ${formatearNota(promedio)}` : "Sin promedio todavía"}
                    {!carrera.total_materias_plan && suyas.length > 0 && " · avance sobre las materias cargadas"}
                  </p>
                  {activa ? (
                    <span className="badge" style={{ background: "var(--color-primary-soft)", color: "var(--color-primary)" }}>
                      <Check size={12} strokeWidth={3} /> La estás viendo
                    </span>
                  ) : (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setCarreraActivaId(carrera.id); toast(`Viendo ${carrera.nombre}`); }}>
                      <Eye size={14} /> Ver esta carrera
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editando !== undefined && (
        <CarreraModal carrera={editando} usados={carreras.map((c) => c.color)} onCerrar={() => setEditando(undefined)} />
      )}
    </main>
  );
}

function CarreraModal({
  carrera, usados, onCerrar,
}: {
  carrera: Carrera | null;
  usados: (string | undefined)[];
  onCerrar: () => void;
}) {
  const { user } = useAuthContext();
  const toast = useToast();
  const { carreras, setCarreraActivaId } = useCarreraActivaContext();

  const [nombre, setNombre] = useState(carrera?.nombre ?? "");
  const [institucion, setInstitucion] = useState(carrera?.institucion ?? "");
  const [total, setTotal] = useState(carrera?.total_materias_plan ? String(carrera.total_materias_plan) : "");
  // Una carrera nueva arranca con el primer color que todavía no se usó.
  const [color, setColor] = useState(carrera?.color ?? COLORES.find((c) => !usados.includes(c)) ?? COLORES[0]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!nombre.trim()) { setError("Escribí el nombre de la carrera."); return; }
    const totalNum = total ? Number(total) : undefined;
    if (totalNum !== undefined && (!Number.isInteger(totalNum) || totalNum < 1 || totalNum > 200)) {
      setError("La cantidad de materias tiene que ser un número entre 1 y 200.");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      if (carrera) {
        await updateCarrera(user.uid, carrera.id, {
          nombre: nombre.trim(),
          institucion: institucion.trim(),
          color,
          // Vaciar el campo tiene que borrar el valor guardado.
          total_materias_plan: totalNum ?? (deleteField() as unknown as number),
        });
        toast("Carrera actualizada");
      } else {
        const id = await addCarrera(user.uid, {
          nombre: nombre.trim(),
          institucion: institucion.trim(),
          total_materias_plan: totalNum,
          color,
        });
        // La primera carrera pasa a ser la que se mira: es lo que uno espera.
        if (carreras.length === 0) setCarreraActivaId(id);
        toast("Carrera creada");
      }
      onCerrar();
    } catch {
      setError("No se pudo guardar. Revisá tu conexión e intentá de nuevo.");
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={carrera ? "Editar carrera" : "Nueva carrera"} icono={<GraduationCap size={20} />} onCerrar={onCerrar}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <div className="notice notice-error" role="alert">{error}</div>}

        <Campo label="Nombre" htmlFor="car-nombre">
          <input id="car-nombre" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Ingeniería en Sistemas" maxLength={200} autoFocus />
        </Campo>

        <Campo label="Facultad o universidad" htmlFor="car-institucion" opcional
          ayuda="Sirve para conectarte con los comentarios de otros estudiantes de tu facultad.">
          <input id="car-institucion" className="input" value={institucion} onChange={(e) => setInstitucion(e.target.value)}
            placeholder="Ej: UTN FRC" maxLength={200} />
        </Campo>

        <Campo label="Materias que tiene el plan" htmlFor="car-total" opcional
          ayuda="Con este número el avance se calcula sobre toda la carrera y no solo sobre las materias que cargaste.">
          <input id="car-total" className="input no-spin tabular" type="number" inputMode="numeric" min={1} max={200}
            value={total} onChange={(e) => setTotal(e.target.value)} placeholder="Ej: 42" />
        </Campo>

        <div>
          <span className="label" id="car-color-label">Color</span>
          <div className="flex gap-2.5 flex-wrap" role="radiogroup" aria-labelledby="car-color-label">
            {COLORES.map((c, i) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={`Color ${i + 1}`}
                onClick={() => setColor(c)}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                style={{
                  background: c,
                  boxShadow: color === c ? `0 0 0 2px var(--color-card), 0 0 0 4px ${c}` : undefined,
                }}
              >
                {color === c && <Check size={16} strokeWidth={3} color="white" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" className="btn btn-secondary flex-1" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn btn-primary flex-1" disabled={guardando}>
            {guardando && <Spinner size={14} />}
            {guardando ? "Guardando..." : carrera ? "Guardar cambios" : "Crear carrera"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
