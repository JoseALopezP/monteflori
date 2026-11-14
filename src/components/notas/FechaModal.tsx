"use client";

// src/components/notas/FechaModal.tsx
// Agendar una fecha de examen (o editar una ya cargada). Igual que cargar una
// nota, se puede abrir desde cualquier pantalla o desde una materia puntual.
// Al guardar se avisa a Google Calendar sin esperar la respuesta.

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Campo, Spinner } from "@/components/ui/kit";
import { useToast } from "@/components/ui/Feedback";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { addFechaImportante, updateFechaImportante } from "@/lib/firestore";
import { sincronizarCalendar } from "@/lib/calendarCliente";
import { TIPOS_EVALUACION, TIPOS_ORDEN } from "@/lib/estados";
import { etiquetaRelativa } from "@/lib/fechas";
import { FechaImportante, Materia } from "@/types";

interface FechaModalProps {
  materias: Materia[];
  materiaIdInicial?: string;
  /** Si se pasa, se edita esa fecha */
  fecha?: FechaImportante;
  onCerrar: () => void;
}

export function FechaModal({ materias, materiaIdInicial, fecha, onCerrar }: FechaModalProps) {
  const { user } = useAuthContext();
  const toast = useToast();
  const editando = !!fecha;

  const cursando = materias.filter((m) => m.estado === "cursando");
  const otras = materias.filter((m) => m.estado !== "cursando");

  const [materiaId, setMateriaId] = useState(
    materiaIdInicial ?? (cursando.length === 1 ? cursando[0].id : "")
  );
  const [tipo, setTipo] = useState<FechaImportante["tipo"]>(fecha?.tipo ?? "parcial");
  const [nombreEscrito, setNombreEscrito] = useState<string | null>(fecha?.nombre ?? null);
  const [dia, setDia] = useState(fecha?.fecha?.slice(0, 10) ?? "");
  const [hora, setHora] = useState(fecha?.fecha && fecha.fecha.length > 10 ? fecha.fecha.slice(11, 16) : "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const materia = materias.find((m) => m.id === materiaId) ?? null;
  const existentes = materia?.fechas_importantes ?? [];

  const sugerido = `${TIPOS_EVALUACION[tipo].label} ${existentes.filter((f) => f.tipo === tipo).length + 1}`;
  const nombre = nombreEscrito ?? sugerido;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !materia) { setError("Elegí a qué materia corresponde."); return; }
    if (!nombre.trim()) { setError("Ponele un nombre a la fecha."); return; }
    if (!dia) { setError("Elegí el día."); return; }

    setError(null);
    setGuardando(true);
    const datos = {
      nombre: nombre.trim(),
      tipo,
      // Con hora: "2026-03-12T18:30". Sin hora: solo el día (evento de día completo).
      fecha: hora ? `${dia}T${hora}` : dia,
    };
    try {
      if (fecha) {
        await updateFechaImportante(user.uid, materia.id, fecha.id, datos, existentes);
        toast("Fecha actualizada");
      } else {
        await addFechaImportante(user.uid, materia.id, datos, existentes);
        toast(`Agendado: ${datos.nombre} · ${etiquetaRelativa(datos.fecha).toLowerCase()}`);
      }
      // Sin await: que Google responda no debería demorar el formulario. Si
      // falla, el servidor lo registra y el aviso aparece arriba de la pantalla.
      sincronizarCalendar(user);
      onCerrar();
    } catch {
      setError("No se pudo guardar. Revisá tu conexión e intentá de nuevo.");
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={editando ? "Editar fecha" : "Agendar fecha"}
      descripcion={
        materiaIdInicial && materia
          ? materia.nombre
          : "Parciales, finales, entregas: lo que no te querés olvidar."
      }
      icono={<CalendarPlus size={20} />}
      onCerrar={onCerrar}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <div className="notice notice-error" role="alert">{error}</div>}

        {!materiaIdInicial && (
          <Campo label="Materia" htmlFor="fecha-materia">
            <select
              id="fecha-materia"
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
          <span className="label" id="fecha-tipo-label">¿Qué es?</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="fecha-tipo-label">
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

        <Campo label="Nombre" htmlFor="fecha-nombre">
          <input
            id="fecha-nombre"
            className="input"
            value={nombre}
            onChange={(e) => setNombreEscrito(e.target.value)}
            maxLength={80}
          />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Día" htmlFor="fecha-dia">
            <input
              id="fecha-dia"
              type="date"
              className="input"
              value={dia}
              onChange={(e) => setDia(e.target.value)}
            />
          </Campo>
          <Campo label="Hora" htmlFor="fecha-hora" opcional>
            <input
              id="fecha-hora"
              type="time"
              className="input"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </Campo>
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" className="btn btn-secondary flex-1" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary flex-1" disabled={guardando}>
            {guardando && <Spinner size={14} />}
            {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Agendar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
