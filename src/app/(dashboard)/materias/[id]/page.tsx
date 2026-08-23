"use client";

// src/app/(dashboard)/materias/[id]/page.tsx
// Detalle completo de materia: evaluaciones, fechas importantes, notas y edición

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen, Calendar, Plus, Trash2, Edit2, Clock, CheckCircle,
  AlertCircle, Star, Lock, Award, ChevronLeft, Loader2, Settings2
} from "lucide-react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useMaterias } from "@/hooks/useMaterias";
import { useCarreras } from "@/hooks/useCarreras";
import {
  updateMateria,
  addEvaluacion,
  updateEvaluacion,
  deleteEvaluacion,
  addFechaImportante,
  deleteFechaImportante,
  deleteMateria,
} from "@/lib/firestore";
import { calcularResultadoMateria, evaluacionRecuperadaPor, resumenFormula } from "@/lib/calculo-notas";
import { AgregarNotaModal } from "@/components/notas/AgregarNotaModal";
import { sincronizarCalendar } from "@/lib/calendarCliente";
import { Comentarios } from "@/components/comentarios/Comentarios";
import { ConstructorNota } from "@/components/notas/ConstructorNota";
import { Materia, Evaluacion, FechaImportante, ConfiguracionNota } from "@/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface PageParams {
  params: Promise<{ id: string }>;
}

function MateriaDetalleContent({ params }: PageParams) {
  const { id } = use(params);
  const { user } = useAuthContext();
  const router = useRouter();

  const { materias, loading: matLoading } = useMaterias(user?.uid ?? null);
  const { carreras } = useCarreras(user?.uid ?? null);

  const materia = materias.find((m) => m.id === id);

  const [mostrarConstructor, setMostrarConstructor] = useState(false);
  const [mostrarAgregarNota, setMostrarAgregarNota] = useState(false);
  const [editandoVinculoId, setEditandoVinculoId] = useState<string | null>(null);

  const [showFormFecha, setShowFormFecha] = useState(false);
  const [nombreFecha, setNombreFecha] = useState("");
  const [tipoFecha, setTipoFecha] = useState<FechaImportante["tipo"]>("parcial");
  const [fechaStr, setFechaStr] = useState("");
  const [guardandoFecha, setGuardandoFecha] = useState(false);

  // Edición inline de notas
  const [editandoEvalId, setEditandoEvalId] = useState<string | null>(null);
  const [valNotaEdit, setValNotaEdit] = useState<string>("");

  if (matLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <Loader2 size={32} className="animate-spin" style={{ color: "var(--color-primary)" }} />
      </div>
    );
  }

  if (!materia) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center" style={{ background: "var(--background)" }}>
        <div>
          <AlertCircle size={48} className="mx-auto mb-3" style={{ color: "var(--color-alert)" }} />
          <h1 className="text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>Materia no encontrada</h1>
          <Link href="/materias" className="text-sm font-semibold hover:underline" style={{ color: "var(--color-primary)" }}>
            ← Volver a materias
          </Link>
        </div>
      </div>
    );
  }

  const resultado = calcularResultadoMateria(materia);

  // Handlers para evaluaciones
  async function handleGuardarNota(materiaId: string, datos: Omit<Evaluacion, "id">) {
    if (!user?.uid) return;
    const m = materias.find((mm) => mm.id === materiaId);
    if (!m) return;
    await addEvaluacion(user.uid, materiaId, datos, m.evaluaciones);
  }

  async function handleCambiarVinculo(evalId: string, recuperaDeId: string) {
    if (!user?.uid || !materia) return;
    await updateEvaluacion(
      user.uid,
      materia.id,
      evalId,
      { recuperatorio_de: recuperaDeId || undefined },
      materia.evaluaciones
    );
    setEditandoVinculoId(null);
  }

  async function handleGuardarNotaInline(evalId: string) {
    if (!user?.uid || !materia) return;
    const nota = valNotaEdit === "" ? null : parseFloat(valNotaEdit);
    await updateEvaluacion(user.uid, materia.id, evalId, { nota }, materia.evaluaciones);
    setEditandoEvalId(null);
  }

  async function handleEliminarEvaluacion(evalId: string) {
    if (!user?.uid || !materia) return;
    await deleteEvaluacion(user.uid, materia.id, evalId, materia.evaluaciones);
  }

  // Handlers para fechas importantes
  async function handleCrearFecha(e: React.FormEvent) {
    e.preventDefault();
    if (!nombreFecha.trim() || !fechaStr || !user?.uid || !materia) return;
    setGuardandoFecha(true);
    try {
      await addFechaImportante(user.uid, materia.id, {
        nombre: nombreFecha.trim(),
        tipo: tipoFecha,
        fecha: fechaStr,
      }, materia.fechas_importantes);
      setNombreFecha("");
      setFechaStr("");
      setShowFormFecha(false);
      // Sin await: que Google responda no debería demorar el formulario. Si
      // falla, el servidor lo registra y el aviso aparece en el dashboard.
      if (user) sincronizarCalendar(user);
    } finally {
      setGuardandoFecha(false);
    }
  }

  async function handleEliminarFecha(fechaId: string) {
    if (!user?.uid || !materia) return;
    await deleteFechaImportante(user.uid, materia.id, fechaId, materia.fechas_importantes);
    // La sincronización detecta la fecha faltante y borra su evento de Google.
    if (user) sincronizarCalendar(user);
  }

  async function handleCambiarEstado(nuevoEstado: Materia["estado"]) {
    if (!user?.uid || !materia) return;
    await updateMateria(user.uid, materia.id, { estado: nuevoEstado });
  }

  async function handleGuardarFormula(nuevaConfig: ConfiguracionNota) {
    if (!user?.uid || !materia) return;
    await updateMateria(user.uid, materia.id, { configuracion_nota: nuevaConfig });
  }

  async function handleEliminarMateria() {
    if (!user?.uid || !materia) return;
    if (confirm(`¿Seguro que querés eliminar ${materia.nombre}? Esta acción no se puede deshacer.`)) {
      await deleteMateria(user.uid, materia.id);
      router.push("/materias");
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
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Top Header */}
        <div className="flex items-center justify-between">
          <Link href="/materias" className="flex items-center gap-1 text-sm font-semibold hover:underline"
            style={{ color: "var(--foreground-muted)" }}>
            <ChevronLeft size={16} /> Materias
          </Link>
          <button onClick={handleEliminarMateria}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-75"
            style={{ color: "var(--color-alert)", background: "var(--estado-libre-bg)" }}>
            <Trash2 size={14} /> Eliminar materia
          </button>
        </div>

        {/* Card Principal: Info de Materia */}
        <div className="rounded-2xl p-6 border shadow-sm"
          style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-md"
                  style={{ background: "var(--color-card-border)", color: "var(--foreground-muted)" }}>
                  {materia.codigo_interno ?? "MATERIA"}
                </span>
                {materia.periodo_cursado && (
                  <span className="text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>
                    {materia.periodo_cursado}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-extrabold" style={{ color: "var(--foreground)" }}>
                {materia.nombre}
              </h1>
            </div>

            {/* Selector de Estado */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>
                Estado:
              </label>
              <select
                value={materia.estado}
                onChange={(e) => handleCambiarEstado(e.target.value as Materia["estado"])}
                className="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                style={{
                  background: "var(--background-alt)",
                  borderColor: "var(--color-card-border)",
                  color: "var(--foreground)",
                }}
              >
                <option value="cursando">Cursando</option>
                <option value="aprobada">Aprobada</option>
                <option value="regular">Regular</option>
                <option value="pendiente">Pendiente</option>
                <option value="libre">Libre</option>
              </select>
            </div>
          </div>

          {/* Resumen de Notas / Promedio */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t"
            style={{ borderColor: "var(--color-card-border)" }}>
            <div>
              <p className="text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Promedio Actual</p>
              <p className="text-2xl font-extrabold" style={{ color: "var(--color-primary)" }}>
                {resultado.promedio_actual > 0 ? resultado.promedio_actual.toFixed(2) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Cómo se calcula</p>
              <button
                onClick={() => setMostrarConstructor(true)}
                className="text-sm font-bold mt-1 flex items-center gap-1.5 hover:opacity-75 transition-opacity"
                style={{ color: "var(--color-primary)" }}
              >
                <Settings2 size={13} />
                {resumenFormula(materia.configuracion_nota)}
              </button>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
                Aprobar: {materia.configuracion_nota.nota_aprobar} · Promocionar: {materia.configuracion_nota.nota_promocionar}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>Estado de Cursada</p>
              <p className="text-xs font-bold mt-1.5 px-2.5 py-1 rounded-lg inline-block"
                style={{
                  background: resultado.puede_promocionar ? "var(--estado-aprobada-bg)" : "var(--background-alt)",
                  color: resultado.puede_promocionar ? "var(--estado-aprobada)" : "var(--foreground)",
                }}>
                {resultado.puede_promocionar ? "Promocionable 🌟" : resultado.puede_aprobar ? "Aprobando 👍" : "En curso 📖"}
              </p>
            </div>
          </div>
        </div>

        {/* Sección: Evaluaciones / Calificaciones */}
        <div className="rounded-2xl p-6 border shadow-sm"
          style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Award size={18} style={{ color: "var(--color-primary)" }} />
              Evaluaciones y Calificaciones
            </h2>
            <button
              onClick={() => setMostrarAgregarNota(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{ background: "var(--color-primary)", color: "white" }}>
              <Plus size={14} /> Nueva evaluación
            </button>
          </div>

          {/* Lista de Evaluaciones */}
          {materia.evaluaciones.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: "var(--foreground-subtle)" }}>
              No hay evaluaciones cargadas para esta materia.
            </p>
          ) : (
            <div className="space-y-2">
              {materia.evaluaciones.map((ev) => {
                const recuperadaPor = evaluacionRecuperadaPor(ev.id, materia.evaluaciones);
                const otrasEvaluaciones = materia.evaluaciones.filter((e) => e.id !== ev.id && e.tipo !== "recuperatorio");

                return (
                  <div key={ev.id} className="p-3 rounded-xl border transition-all"
                    style={{ background: "var(--background-alt)", borderColor: "var(--color-card-border)" }}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                        <span className="text-xs font-bold uppercase px-2 py-0.5 rounded flex-shrink-0"
                          style={{ background: "var(--color-card-border)", color: "var(--foreground-muted)", fontSize: "10px" }}>
                          {ev.tipo}
                        </span>
                        <span className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>
                          {ev.nombre}
                        </span>
                        {recuperadaPor && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: "var(--estado-cursando-bg)", color: "var(--estado-cursando)" }}>
                            Recuperada por: {recuperadaPor.nombre}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Inline edit nota */}
                        {editandoEvalId === ev.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={10}
                              step={0.5}
                              value={valNotaEdit}
                              onChange={(e) => setValNotaEdit(e.target.value)}
                              className="w-14 text-center text-xs font-bold rounded-lg p-1 border"
                              style={{ background: "var(--color-card)", borderColor: "var(--color-primary)", color: "var(--foreground)" }}
                              autoFocus
                            />
                            <button onClick={() => handleGuardarNotaInline(ev.id)} className="text-xs font-bold px-2 py-1 rounded bg-emerald-600 text-white">
                              ✓
                            </button>
                            <button onClick={() => setEditandoEvalId(null)} className="text-xs px-2 py-1 rounded bg-slate-300">
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditandoEvalId(ev.id);
                              setValNotaEdit(ev.nota !== undefined && ev.nota !== null ? String(ev.nota) : "");
                            }}
                            className="text-sm font-extrabold px-3 py-1 rounded-lg border transition-all hover:opacity-80"
                            style={{
                              background: "var(--color-card)",
                              borderColor: "var(--color-card-border)",
                              color: ev.nota !== undefined && ev.nota !== null ? "var(--color-primary)" : "var(--foreground-subtle)",
                              textDecoration: recuperadaPor ? "line-through" : "none",
                            }}>
                            {ev.nota !== undefined && ev.nota !== null ? ev.nota : "Añadir nota"}
                          </button>
                        )}

                        {ev.tipo === "recuperatorio" && (
                          <button
                            onClick={() => setEditandoVinculoId(editandoVinculoId === ev.id ? null : ev.id)}
                            className="p-1 rounded opacity-60 hover:opacity-100 transition-opacity"
                            style={{ color: "var(--color-secondary)" }}
                            title="Elegir qué evaluación recupera">
                            <Edit2 size={14} />
                          </button>
                        )}

                        <button onClick={() => handleEliminarEvaluacion(ev.id)}
                          className="p-1 rounded opacity-60 hover:opacity-100 transition-opacity"
                          style={{ color: "var(--color-alert)" }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Vínculo: qué evaluación recupera este recuperatorio */}
                    {ev.tipo === "recuperatorio" && editandoVinculoId === ev.id && (
                      <div className="mt-2.5 pt-2.5 border-t" style={{ borderColor: "var(--color-card-border)" }}>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                          ¿Qué evaluación recupera?
                        </label>
                        <select
                          value={ev.recuperatorio_de ?? ""}
                          onChange={(e) => handleCambiarVinculo(ev.id, e.target.value)}
                          style={inputStyle}
                        >
                          <option value="">No recupera ninguna en particular</option>
                          {otrasEvaluaciones.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.nombre} {e.nota !== null && e.nota !== undefined ? `(nota: ${e.nota})` : "(sin nota)"}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sección: Fechas Importantes */}
        <div className="rounded-2xl p-6 border shadow-sm"
          style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Calendar size={18} style={{ color: "var(--color-secondary)" }} />
              Fechas Importantes
            </h2>
            <button
              onClick={() => setShowFormFecha(!showFormFecha)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{ background: "var(--color-secondary)", color: "white" }}>
              <Plus size={14} /> Nueva fecha
            </button>
          </div>

          {/* Formulario de nueva fecha */}
          {showFormFecha && (
            <form onSubmit={handleCrearFecha} className="p-4 rounded-xl border mb-4 space-y-3 animate-fade-in"
              style={{ background: "var(--background-alt)", borderColor: "var(--color-card-border)" }}>
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>
                Agregar fecha importante
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Descripción (ej: 1° Parcial)"
                  value={nombreFecha}
                  onChange={(e) => setNombreFecha(e.target.value)}
                  required
                  style={inputStyle}
                />
                <select
                  value={tipoFecha}
                  onChange={(e) => setTipoFecha(e.target.value as FechaImportante["tipo"])}
                  style={inputStyle}
                >
                  <option value="parcial">Parcial</option>
                  <option value="recuperatorio">Recuperatorio</option>
                  <option value="final">Final</option>
                  <option value="tp">TP</option>
                  <option value="coloquio">Coloquio</option>
                  <option value="otro">Otro</option>
                </select>
                <input
                  type="datetime-local"
                  value={fechaStr}
                  onChange={(e) => setFechaStr(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowFormFecha(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                  style={{ borderColor: "var(--color-card-border)", color: "var(--foreground-muted)" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={guardandoFecha}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background: "var(--color-secondary)", color: "white" }}>
                  {guardandoFecha ? "Guardando..." : "Guardar fecha"}
                </button>
              </div>
            </form>
          )}

          {/* Lista de Fechas */}
          {(!materia.fechas_importantes || materia.fechas_importantes.length === 0) ? (
            <p className="text-xs text-center py-6" style={{ color: "var(--foreground-subtle)" }}>
              No hay fechas registradas para esta materia.
            </p>
          ) : (
            <div className="space-y-2">
              {materia.fechas_importantes.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-xl border transition-all"
                  style={{ background: "var(--background-alt)", borderColor: "var(--color-card-border)" }}>
                  <div className="flex items-center gap-3">
                    <Clock size={16} style={{ color: "var(--color-secondary)" }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        {f.nombre}
                      </p>
                      <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                        {f.fecha ? format(parseISO(f.fecha), "PPP - p", { locale: es }) : "Sin fecha"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEliminarFecha(f.id)}
                      className="p-1 rounded opacity-60 hover:opacity-100 transition-opacity"
                      style={{ color: "var(--color-alert)" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comentarios: solo si la materia está vinculada al catálogo compartido */}
        {materia.catalogo_id && (
          <Comentarios
            catalogoId={materia.catalogo_id}
            carreraContexto={
              carreras.find((c) => materia.carreras_vinculadas?.includes(c.id))?.nombre ?? null
            }
          />
        )}

      </div>

      {mostrarConstructor && (
        <ConstructorNota
          config={materia.configuracion_nota}
          evaluaciones={materia.evaluaciones}
          onGuardar={handleGuardarFormula}
          onCerrar={() => setMostrarConstructor(false)}
        />
      )}

      {mostrarAgregarNota && (
        <AgregarNotaModal
          materias={[materia]}
          materiaIdInicial={materia.id}
          onGuardar={handleGuardarNota}
          onCerrar={() => setMostrarAgregarNota(false)}
        />
      )}
    </div>
  );
}

export default function MateriaDetallePage(props: PageParams) {
  return (
    <AuthGuard>
      <MateriaDetalleContent params={props.params} />
    </AuthGuard>
  );
}
