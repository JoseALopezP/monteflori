"use client";

// src/components/notas/AgregarNotaModal.tsx
// Cargar una evaluación (o editar una existente). Se abre desde cualquier
// pantalla con el botón "+" de la navegación, y desde el detalle de una
// materia con esa materia ya fija.
//
// Si el tipo es "recuperatorio" se puede vincular a la evaluación que
// recupera: esa no se borra, pero queda afuera del cálculo de la nota final.

import { useState } from "react";
import { Award } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Campo, Spinner } from "@/components/ui/kit";
import { useToast } from "@/components/ui/Feedback";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { addEvaluacion, updateEvaluacion } from "@/lib/firestore";
import { TIPOS_EVALUACION, TIPOS_ORDEN, parsearNota } from "@/lib/estados";
import { Materia, Evaluacion, TipoEvaluacion } from "@/types";

interface AgregarNotaModalProps {
  materias: Materia[];
  /** Si se pasa, la materia queda fija (no se muestra el selector) */
  materiaIdInicial?: string;
  /** Si se pasa, se edita esa evaluación en vez de crear una */
  evaluacion?: Evaluacion;
  onCerrar: () => void;
}

export function AgregarNotaModal({ materias, materiaIdInicial, evaluacion, onCerrar }: AgregarNotaModalProps) {
  const { user } = useAuthContext();
  const toast = useToast();
  const editando = !!evaluacion;

  const cursando = materias.filter((m) => m.estado === "cursando");
  const otras = materias.filter((m) => m.estado !== "cursando");

  // Con una sola materia en curso no hay nada que elegir.
  const [materiaId, setMateriaId] = useState(
    materiaIdInicial ?? (cursando.length === 1 ? cursando[0].id : "")
  );
  const [tipo, setTipo] = useState<TipoEvaluacion>(evaluacion?.tipo ?? "parcial");
  const [nombreEscrito, setNombreEscrito] = useState<string | null>(evaluacion?.nombre ?? null);
  const [nota, setNota] = useState(
    evaluacion?.nota !== null && evaluacion?.nota !== undefined ? String(evaluacion.nota).replace(".", ",") : ""
  );
  const [fecha, setFecha] = useState(evaluacion?.fecha?.slice(0, 10) ?? "");
  const [recuperaDeId, setRecuperaDeId] = useState(evaluacion?.recuperatorio_de ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const materia = materias.find((m) => m.id === materiaId) ?? null;
  const existentes = materia?.evaluaciones ?? [];
  const candidatasARecuperar = existentes.filter(
    (e) => e.tipo !== "recuperatorio" && e.id !== evaluacion?.id
  );

  // Sugiere "Parcial 2" mientras el usuario no escriba un nombre propio.
  const sugerido = `${TIPOS_EVALUACION[tipo].label} ${existentes.filter((e) => e.tipo === tipo).length + 1}`;
  const nombre = nombreEscrito ?? sugerido;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !materia) { setError("Elegí a qué materia corresponde."); return; }
    if (!nombre.trim()) { setError("Ponele un nombre a la evaluación."); return; }
    const notaNum = parsearNota(nota);
    if (Number.isNaN(notaNum)) { setError("La nota tiene que ser un número entre 0 y 10."); return; }

    setError(null);
    setGuardando(true);
    const datos: Omit<Evaluacion, "id"> = {
      nombre: nombre.trim(),
      tipo,
      nota: notaNum,
      fecha: fecha || null,
      recuperatorio_de: tipo === "recuperatorio" && recuperaDeId ? recuperaDeId : undefined,
    };
    try {
      if (evaluacion) {
        await updateEvaluacion(user.uid, materia.id, evaluacion.id, datos, existentes);
        toast("Evaluación actualizada");
      } else {
        await addEvaluacion(user.uid, materia.id, datos, existentes);
        toast(notaNum === null ? "Evaluación agregada" : `Nota guardada en ${materia.nombre}`);
      }
      onCerrar();
    } catch {
      setError("No se pudo guardar. Revisá tu conexión e intentá de nuevo.");
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={editando ? "Editar evaluación" : "Cargar nota"}
      descripcion={
        materiaIdInicial && materia
          ? materia.nombre
          : "Podés dejar la nota vacía y completarla cuando la tengas."
      }
      icono={<Award size={20} />}
      onCerrar={onCerrar}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <div className="notice notice-error" role="alert">{error}</div>}

        {!materiaIdInicial && (
          <Campo label="Materia" htmlFor="nota-materia">
            <select
              id="nota-materia"
              className="input"
              value={materiaId}
              onChange={(e) => setMateriaId(e.target.value)}
              autoFocus={!materiaId}
            >
              <option value="">Elegí una materia</option>
              {cursando.length > 0 && (
                <optgroup label="Cursando ahora">
                  {cursando.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </optgroup>
              )}
              {otras.length > 0 && (
                <optgroup label={cursando.length > 0 ? "Otras materias" : "Materias"}>
                  {otras.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </optgroup>
              )}
            </select>
          </Campo>
        )}

        <div>
          <span className="label" id="nota-tipo-label">¿Qué fue?</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="nota-tipo-label">
            {TIPOS_ORDEN.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={tipo === t}
                onClick={() => setTipo(t)}
                className="chip"
              >
                {TIPOS_EVALUACION[t].label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_6.5rem] gap-3">
          <Campo label="Nombre" htmlFor="nota-nombre">
            <input
              id="nota-nombre"
              className="input"
              value={nombre}
              onChange={(e) => setNombreEscrito(e.target.value)}
              maxLength={80}
            />
          </Campo>
          <Campo label="Nota" htmlFor="nota-valor">
            <input
              id="nota-valor"
              className="input tabular text-center font-bold"
              inputMode="decimal"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="0 a 10"
              autoFocus={!!materiaId}
            />
          </Campo>
        </div>

        <Campo label="Fecha" htmlFor="nota-fecha" opcional>
          <input
            id="nota-fecha"
            type="date"
            className="input"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </Campo>

        {tipo === "recuperatorio" && (
          <div className="rounded-[var(--radius-md)] bg-background-alt p-3.5">
            {candidatasARecuperar.length === 0 ? (
              <p className="text-sm text-foreground-muted">
                {materia
                  ? "Esta materia todavía no tiene otra evaluación cargada para vincular."
                  : "Elegí la materia para poder vincularlo a la evaluación que recupera."}
              </p>
            ) : (
              <Campo
                label="¿Qué evaluación recupera?"
                htmlFor="nota-recupera"
                opcional
                ayuda="La nota original no se borra: queda en tu historial, pero para la nota final cuenta esta."
              >
                <select
                  id="nota-recupera"
                  className="input"
                  value={recuperaDeId}
                  onChange={(e) => setRecuperaDeId(e.target.value)}
                >
                  <option value="">Ninguna en particular</option>
                  {candidatasARecuperar.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.nombre}
                      {ev.nota !== null && ev.nota !== undefined ? ` — sacaste ${ev.nota}` : " — sin nota"}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" className="btn btn-secondary flex-1" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary flex-1" disabled={guardando}>
            {guardando && <Spinner size={14} />}
            {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
