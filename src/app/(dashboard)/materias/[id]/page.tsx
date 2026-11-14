"use client";

// src/app/(dashboard)/materias/[id]/page.tsx
// Todo sobre una materia: cómo voy, mis notas, las fechas que vienen, qué
// necesito para cursarla y qué me habilita, y lo que cuentan otros estudiantes.

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import {
  Award, CalendarArrowDown, CalendarDays, CalendarPlus, Check, CircleDashed, GitBranch, MoreVertical,
  Pencil, Plus, SearchX, SlidersHorizontal, Trash2,
} from "lucide-react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useMaterias } from "@/hooks/useMaterias";
import { useCarreraActivaContext } from "@/components/dashboard/CarreraActivaProvider";
import { useConfirm, useToast } from "@/components/ui/Feedback";
import { EmptyState, Esqueleto, NotaEditable, PageHeader } from "@/components/ui/kit";
import { AgregarNotaModal } from "@/components/notas/AgregarNotaModal";
import { FechaModal } from "@/components/notas/FechaModal";
import { ConstructorNota } from "@/components/notas/ConstructorNota";
import { Comentarios } from "@/components/comentarios/Comentarios";
import {
  updateMateria, updateEvaluacion, deleteEvaluacion, deleteFechaImportante, deleteMateria,
} from "@/lib/firestore";
import { calcularResultadoMateria, evaluacionRecuperadaPor, resumenFormula } from "@/lib/calculo-notas";
import { sincronizarCalendar } from "@/lib/calendarCliente";
import { ESTADOS, ESTADOS_ORDEN, colorNota, formatearNota, infoEstado, infoTipo } from "@/lib/estados";
import { diasHasta, esProxima, etiquetaRelativa, formatearFechaCorta, formatearFechaLarga } from "@/lib/fechas";
import { descargarIcs, nombreDeArchivo } from "@/lib/ics";
import { ConfiguracionNota, EstadoMateria, Evaluacion, FechaImportante } from "@/types";

type ModalAbierto =
  | { tipo: "nota"; evaluacion?: Evaluacion }
  | { tipo: "fecha"; fecha?: FechaImportante }
  | { tipo: "formula" }
  | null;

export default function MateriaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthContext();
  const router = useRouter();
  const toast = useToast();
  const confirmar = useConfirm();
  const { materias, loading } = useMaterias();
  const { carreras } = useCarreraActivaContext();

  const [modal, setModal] = useState<ModalAbierto>(null);
  const [verPasadas, setVerPasadas] = useState(false);

  const materia = materias.find((m) => m.id === id);

  if (loading) {
    return (
      <main className="page page-narrow">
        <Esqueleto filas={3} alto="h-36" />
      </main>
    );
  }

  if (!materia || !user) {
    return (
      <main className="page page-narrow">
        <EmptyState
          icono={<SearchX size={22} />}
          titulo="No encontramos esta materia"
          texto="Puede que la hayas eliminado o que el link esté mal."
        >
          <Link href="/materias" className="btn btn-primary">Ver mis materias</Link>
        </EmptyState>
      </main>
    );
  }

  const uid = user.uid;
  const resultado = calcularResultadoMateria(materia);
  const config = materia.configuracion_nota;
  const tieneNotas = resultado.nota_proyectada !== null;
  const estado = infoEstado(materia.estado);

  const fechas = [...(materia.fechas_importantes ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const fechasProximas = fechas.filter((f) => esProxima(f.fecha));
  const fechasPasadas = fechas.filter((f) => !esProxima(f.fecha)).reverse();

  const requisitos = (materia.correlativas_requisito ?? [])
    .map((cid) => materias.find((m) => m.id === cid))
    .filter((m) => m !== undefined);
  const habilita = materias.filter((m) => m.correlativas_requisito?.includes(materia.id));
  const faltan = requisitos.filter((m) => m.estado !== "aprobada" && m.estado !== "regular");

  const carrerasDeLaMateria = carreras.filter((c) => materia.carreras_vinculadas?.includes(c.id));
  const subtitulo = [
    materia.codigo_interno,
    materia.año_plan ? `${materia.año_plan}° año` : null,
    materia.periodo_cursado,
    ...carrerasDeLaMateria.map((c) => c.nombre),
  ].filter(Boolean).join(" · ");

  const mensajeNota =
    materia.estado === "aprobada"
      ? tieneNotas
        ? `La aprobaste con ${formatearNota(resultado.promedio_actual)}.`
        : "La aprobaste. Si querés que cuente para tu promedio, cargá la nota."
      : !tieneNotas
      ? "Cargá tus notas para ver cómo venís."
      : resultado.puede_promocionar
      ? `Estás en nota de promoción (${config.nota_promocionar} o más).`
      : resultado.puede_aprobar
      ? `Estás aprobando. Para promocionar necesitás llegar a ${config.nota_promocionar}.`
      : `Estás por debajo de ${config.nota_aprobar}, la nota para aprobar.`;

  // ── Acciones ──

  async function cambiarEstado(nuevo: EstadoMateria) {
    if (!materia || nuevo === materia.estado) return;
    try {
      await updateMateria(uid, materia.id, { estado: nuevo });
      toast(`Ahora figura como ${ESTADOS[nuevo].label.toLowerCase()}`);
    } catch {
      toast("No se pudo cambiar el estado", "error");
    }
  }

  async function guardarNota(ev: Evaluacion, nota: number | null) {
    if (!materia) return;
    try {
      await updateEvaluacion(uid, materia.id, ev.id, { nota }, materia.evaluaciones);
      toast(nota === null ? "Nota borrada" : "Nota guardada");
    } catch {
      toast("No se pudo guardar la nota", "error");
    }
  }

  async function eliminarEvaluacion(ev: Evaluacion) {
    if (!materia) return;
    const ok = await confirmar({
      titulo: `¿Eliminar "${ev.nombre}"?`,
      mensaje: ev.nota !== null && ev.nota !== undefined
        ? `Se borra la evaluación junto con su nota (${ev.nota}).`
        : undefined,
    });
    if (!ok) return;
    try {
      await deleteEvaluacion(uid, materia.id, ev.id, materia.evaluaciones);
      toast("Evaluación eliminada");
    } catch {
      toast("No se pudo eliminar", "error");
    }
  }

  async function eliminarFecha(f: FechaImportante) {
    if (!materia || !user) return;
    const ok = await confirmar({
      titulo: `¿Eliminar "${f.nombre}"?`,
      mensaje: "Si tenés Google Calendar conectado, también se borra de tu calendario.",
    });
    if (!ok) return;
    try {
      await deleteFechaImportante(uid, materia.id, f.id, materia.fechas_importantes);
      // La sincronización detecta la fecha faltante y borra su evento de Google.
      sincronizarCalendar(user);
      toast("Fecha eliminada");
    } catch {
      toast("No se pudo eliminar", "error");
    }
  }

  function llevarAlCalendario(f: FechaImportante) {
    if (!materia) return;
    descargarIcs([{ ...f, materiaNombre: materia.nombre }], nombreDeArchivo(`${f.nombre} ${materia.nombre}`));
    toast("Archivo descargado: abrilo para sumarlo a tu calendario");
  }

  async function guardarFormula(nueva: ConfiguracionNota) {
    if (!materia) return;
    await updateMateria(uid, materia.id, { configuracion_nota: nueva });
  }

  async function eliminarMateria() {
    if (!materia || !user) return;
    const ok = await confirmar({
      titulo: `¿Eliminar ${materia.nombre}?`,
      mensaje: "Se borran también sus notas y fechas. No se puede deshacer.",
      accion: "Eliminar materia",
    });
    if (!ok) return;
    try {
      await deleteMateria(uid, materia.id, materias);
      // Sus fechas ya no existen: que también se vayan de Google Calendar.
      sincronizarCalendar(user);
      toast("Materia eliminada");
      router.replace("/materias");
    } catch {
      toast("No se pudo eliminar la materia", "error");
    }
  }

  return (
    <main className="page page-narrow space-y-4">
      <PageHeader
        titulo={materia.nombre}
        subtitulo={subtitulo || undefined}
        volver={{ href: "/materias", label: "Materias" }}
        acciones={
          <>
            <Link href={`/materias/${materia.id}/editar`} className="btn btn-secondary">
              <Pencil size={14} /> Editar
            </Link>
            <Dropdown.Root>
              <Dropdown.Trigger className="icon-btn border border-card-border bg-card" aria-label="Más opciones">
                <MoreVertical size={18} />
              </Dropdown.Trigger>
              <Dropdown.Portal>
                <Dropdown.Content className="menu" align="end" sideOffset={6}>
                  <Dropdown.Item className="menu-item menu-item-danger" onSelect={() => setTimeout(eliminarMateria, 0)}>
                    <Trash2 size={15} /> Eliminar materia
                  </Dropdown.Item>
                </Dropdown.Content>
              </Dropdown.Portal>
            </Dropdown.Root>
          </>
        }
      />

      {/* ── Estado + cómo voy ── */}
      <section className="card card-pad !mt-0">
        <span className="label" id="estado-label">Estado</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="estado-label">
          {ESTADOS_ORDEN.map((e) => {
            const elegido = materia.estado === e;
            return (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={elegido}
                onClick={() => cambiarEstado(e)}
                className="chip"
                style={elegido ? { background: ESTADOS[e].bg, borderColor: ESTADOS[e].color, color: ESTADOS[e].color } : undefined}
              >
                {elegido && <Check size={14} strokeWidth={3} />}
                {ESTADOS[e].label}
              </button>
            );
          })}
        </div>
        <p className="hint">{estado.ayuda}.</p>

        <div className="flex items-center gap-5 mt-5 pt-5 border-t border-card-border">
          <div className="text-center flex-shrink-0 min-w-20">
            <p
              className="font-display tabular text-5xl font-semibold leading-none"
              style={{
                color: tieneNotas
                  ? colorNota(resultado.promedio_actual, config.nota_aprobar, config.nota_promocionar)
                  : "var(--foreground-subtle)",
              }}
            >
              {tieneNotas ? formatearNota(resultado.promedio_actual) : "—"}
            </p>
            <p className="eyebrow mt-2">Nota actual</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{mensajeNota}</p>
            <p className="text-sm text-foreground-muted mt-1">
              Se calcula como: <span className="font-semibold">{resumenFormula(config)}</span>
            </p>
            <button type="button" className="btn btn-ghost btn-sm -ml-3 mt-1" onClick={() => setModal({ tipo: "formula" })}>
              <SlidersHorizontal size={14} /> Cambiar cómo se calcula
            </button>
          </div>
        </div>
      </section>

      {/* ── Notas ── */}
      <section className="card card-pad">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="section-title flex items-center gap-2">
            <Award size={17} className="text-primary" /> Notas
          </h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal({ tipo: "nota" })}>
            <Plus size={14} /> Cargar nota
          </button>
        </div>

        {materia.evaluaciones.length === 0 ? (
          <EmptyState
            plano
            icono={<Award size={22} />}
            titulo="Todavía no hay notas"
            texto="Cargá cada parcial, trabajo práctico o final a medida que te den la nota."
          />
        ) : (
          <ul className="divide-y divide-card-border -my-2">
            {materia.evaluaciones.map((ev) => {
              const recuperadaPor = evaluacionRecuperadaPor(ev.id, materia.evaluaciones);
              const recupera = ev.recuperatorio_de
                ? materia.evaluaciones.find((e) => e.id === ev.recuperatorio_de)
                : null;
              return (
                <li key={ev.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{ev.nombre}</p>
                    <p className="text-xs text-foreground-subtle truncate">
                      {infoTipo(ev.tipo).label}
                      {ev.fecha && ` · ${formatearFechaCorta(ev.fecha)}`}
                      {recupera && ` · recupera ${recupera.nombre}`}
                      {recuperadaPor && ` · reemplazada por ${recuperadaPor.nombre}`}
                    </p>
                  </div>
                  <NotaEditable
                    nota={ev.nota}
                    nombre={ev.nombre}
                    aprobar={config.nota_aprobar}
                    promocionar={config.nota_promocionar}
                    anulada={!!recuperadaPor}
                    onGuardar={(nota) => guardarNota(ev, nota)}
                  />
                  <MenuFila
                    etiqueta={ev.nombre}
                    onEditar={() => setModal({ tipo: "nota", evaluacion: ev })}
                    onEliminar={() => eliminarEvaluacion(ev)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Fechas ── */}
      <section className="card card-pad">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="section-title flex items-center gap-2">
            <CalendarDays size={17} className="text-accent" /> Fechas
          </h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModal({ tipo: "fecha" })}>
            <CalendarPlus size={14} /> Agendar
          </button>
        </div>

        {fechas.length === 0 ? (
          <EmptyState
            plano
            icono={<CalendarDays size={22} />}
            titulo="Sin fechas agendadas"
            texto="Agendá parciales, finales y entregas. Aparecen en tu inicio y, si lo conectás, en Google Calendar."
          />
        ) : (
          <>
            {fechasProximas.length === 0 ? (
              <p className="text-sm text-foreground-muted">No hay fechas próximas.</p>
            ) : (
              <ul className="divide-y divide-card-border -my-2">
                {fechasProximas.map((f) => (
                  <FilaFecha
                    key={f.id}
                    fecha={f}
                    onEditar={() => setModal({ tipo: "fecha", fecha: f })}
                    onEliminar={() => eliminarFecha(f)}
                    onCalendario={() => llevarAlCalendario(f)}
                  />
                ))}
              </ul>
            )}

            {fechasPasadas.length > 0 && (
              <div className="mt-4">
                <button type="button" className="btn btn-ghost btn-sm -ml-3" onClick={() => setVerPasadas((v) => !v)} aria-expanded={verPasadas}>
                  {verPasadas ? "Ocultar" : "Ver"} {fechasPasadas.length} {fechasPasadas.length === 1 ? "fecha pasada" : "fechas pasadas"}
                </button>
                {verPasadas && (
                  <ul className="divide-y divide-card-border mt-1">
                    {fechasPasadas.map((f) => (
                      <FilaFecha
                        key={f.id}
                        fecha={f}
                        pasada
                        onEditar={() => setModal({ tipo: "fecha", fecha: f })}
                        onEliminar={() => eliminarFecha(f)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Correlativas ── */}
      {(requisitos.length > 0 || habilita.length > 0) && (
        <section className="card card-pad">
          <h2 className="section-title flex items-center gap-2 mb-4">
            <GitBranch size={17} className="text-secondary" /> Correlativas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {requisitos.length > 0 && (
              <div>
                <p className="label">
                  Para cursarla necesitás
                  {faltan.length === 0
                    ? <span className="font-medium text-foreground-subtle"> · las tenés todas</span>
                    : <span className="font-medium text-alert"> · te {faltan.length === 1 ? "falta 1" : `faltan ${faltan.length}`}</span>}
                </p>
                <ul className="space-y-1">
                  {requisitos.map((m) => {
                    const cumplida = m.estado === "aprobada" || m.estado === "regular";
                    return (
                      <li key={m.id}>
                        <Link href={`/materias/${m.id}`} className="row-hover flex items-center gap-2 -mx-2 px-2 py-1.5 rounded-[var(--radius-sm)] text-sm">
                          {cumplida
                            ? <Check size={15} strokeWidth={3} className="text-primary flex-shrink-0" />
                            : <CircleDashed size={15} className="text-foreground-subtle flex-shrink-0" />}
                          <span className="flex-1 min-w-0 truncate font-semibold text-foreground">{m.nombre}</span>
                          <span className="text-xs text-foreground-subtle flex-shrink-0">{infoEstado(m.estado).label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {habilita.length > 0 && (
              <div>
                <p className="label">Aprobarla te habilita</p>
                <ul className="space-y-1">
                  {habilita.map((m) => (
                    <li key={m.id}>
                      <Link href={`/materias/${m.id}`} className="row-hover flex items-center gap-2 -mx-2 px-2 py-1.5 rounded-[var(--radius-sm)] text-sm">
                        <span className="w-2 h-2 rounded-full flex-shrink-0 mx-[3.5px]" style={{ background: infoEstado(m.estado).color }} />
                        <span className="flex-1 min-w-0 truncate font-semibold text-foreground">{m.nombre}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Comentarios: solo si la materia está vinculada al catálogo compartido */}
      {materia.catalogo_id && (
        <Comentarios
          catalogoId={materia.catalogo_id}
          carreraContexto={carrerasDeLaMateria[0]?.nombre ?? null}
        />
      )}

      {modal?.tipo === "nota" && (
        <AgregarNotaModal
          materias={[materia]}
          materiaIdInicial={materia.id}
          evaluacion={modal.evaluacion}
          onCerrar={() => setModal(null)}
        />
      )}
      {modal?.tipo === "fecha" && (
        <FechaModal
          materias={[materia]}
          materiaIdInicial={materia.id}
          fecha={modal.fecha}
          onCerrar={() => setModal(null)}
        />
      )}
      {modal?.tipo === "formula" && (
        <ConstructorNota
          config={config}
          evaluaciones={materia.evaluaciones}
          onGuardar={guardarFormula}
          onCerrar={() => setModal(null)}
        />
      )}
    </main>
  );
}

// ── Piezas ──────────────────────────────────────────────────

function MenuFila({ etiqueta, onEditar, onEliminar, onCalendario }: {
  etiqueta: string;
  onEditar: () => void;
  onEliminar: () => void;
  /** Solo para fechas: descarga el evento para Apple, Samsung, Outlook o el calendario que sea */
  onCalendario?: () => void;
}) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger className="icon-btn icon-btn-sm -mr-2" aria-label={`Opciones de ${etiqueta}`}>
        <MoreVertical size={16} />
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className="menu !min-w-40" align="end" sideOffset={4}>
          {onCalendario && (
            <Dropdown.Item className="menu-item" onSelect={onCalendario}>
              <CalendarArrowDown size={14} /> Agregar a mi calendario
            </Dropdown.Item>
          )}
          {/* Un tick después: el menú termina de cerrarse antes de que abra el diálogo. */}
          <Dropdown.Item className="menu-item" onSelect={() => setTimeout(onEditar, 0)}>
            <Pencil size={14} /> Editar
          </Dropdown.Item>
          <Dropdown.Item className="menu-item menu-item-danger" onSelect={() => setTimeout(onEliminar, 0)}>
            <Trash2 size={14} /> Eliminar
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

function FilaFecha({
  fecha, pasada, onEditar, onEliminar, onCalendario,
}: {
  fecha: FechaImportante; pasada?: boolean; onEditar: () => void; onEliminar: () => void; onCalendario?: () => void;
}) {
  const dias = diasHasta(fecha.fecha);
  const urgente = !pasada && dias !== null && dias <= 3;
  return (
    <li className="flex items-center gap-3 py-2.5" style={{ opacity: pasada ? 0.65 : 1 }}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground truncate">{fecha.nombre}</p>
        <p className="text-xs text-foreground-subtle truncate first-letter:uppercase">
          {formatearFechaLarga(fecha.fecha)}
        </p>
      </div>
      <span
        className="badge flex-shrink-0"
        style={urgente ? { background: "var(--estado-libre-bg)", color: "var(--color-alert)" } : undefined}
      >
        {etiquetaRelativa(fecha.fecha)}
      </span>
      <MenuFila etiqueta={fecha.nombre} onEditar={onEditar} onEliminar={onEliminar} onCalendario={pasada ? undefined : onCalendario} />
    </li>
  );
}
