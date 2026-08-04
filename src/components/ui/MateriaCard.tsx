"use client";

// src/components/ui/MateriaCard.tsx
// Tarjeta de materia expandible con datos reales y edición inline de notas

import { useState } from "react";
import {
  ChevronDown, ChevronUp, AlertCircle, CheckCircle,
  BookOpen, Calendar, Lock, Star, Clock
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Materia } from "@/types";
import { calcularResultadoMateria, resumenFormula } from "@/lib/calculo-notas";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface MateriaCardProps {
  materia: Materia;
  onEditarNota?: (materiaId: string, evaluacionId: string, nota: number | null) => void;
  onAbrirDetalle?: (materiaId: string) => void;
}

const ESTADO_CONFIG = {
  aprobada: { label: "Aprobada", color: "var(--estado-aprobada)", bg: "var(--estado-aprobada-bg)", icon: CheckCircle },
  cursando: { label: "Cursando", color: "var(--estado-cursando)", bg: "var(--estado-cursando-bg)", icon: BookOpen },
  regular: { label: "Regular", color: "var(--estado-regular)", bg: "var(--estado-regular-bg)", icon: Star },
  libre: { label: "Libre", color: "var(--estado-libre)", bg: "var(--estado-libre-bg)", icon: AlertCircle },
  pendiente: { label: "Pendiente", color: "var(--estado-pendiente)", bg: "var(--estado-pendiente-bg)", icon: Lock },
};

export default function MateriaCard({
  materia,
  onEditarNota,
  onAbrirDetalle,
}: MateriaCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [valorEdit, setValorEdit] = useState<string>("");

  const resultado = calcularResultadoMateria(materia);
  const cfg = ESTADO_CONFIG[materia.estado] ?? ESTADO_CONFIG.pendiente;
  const IconEstado = cfg.icon;

  const proximaFecha = materia.fechas_importantes
    ?.filter((f) => new Date(f.fecha) >= new Date())
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];

  const grafColor = resultado.puede_promocionar
    ? "var(--color-primary)"
    : resultado.puede_aprobar
    ? "var(--color-accent)"
    : resultado.promedio_actual > 0
    ? "var(--color-alert)"
    : "var(--color-card-border)";

  const donaData = [
    { value: resultado.promedio_actual },
    { value: Math.max(0, 10 - resultado.promedio_actual) },
  ];

  function iniciarEdicion(evId: string, notaActual?: number | null) {
    setEditandoId(evId);
    setValorEdit(notaActual !== undefined && notaActual !== null ? String(notaActual) : "");
  }

  function confirmarEdicion(evId: string) {
    const nota = valorEdit === "" ? null : parseFloat(valorEdit);
    if (nota !== null && (isNaN(nota) || nota < 0 || nota > 10)) return;
    onEditarNota?.(materia.id, evId, nota);
    setEditandoId(null);
  }

  return (
    <div
      className="rounded-xl border overflow-hidden transition-all duration-300 animate-fade-in"
      style={{
        background: "var(--color-card)",
        borderColor: "var(--color-card-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* ── Header siempre visible ── */}
      <div
        className="px-5 py-4 flex items-center gap-3 cursor-pointer transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ background: isExpanded ? "var(--background-alt)" : "transparent" }}
        role="button"
        aria-expanded={isExpanded}
      >
        {/* Indicador de color de estado (lateral) */}
        <div
          className="w-1 h-10 rounded-full flex-shrink-0"
          style={{ background: cfg.color }}
        />

        <div className="flex-1 min-w-0">
          <h3
            className="font-semibold text-base leading-tight truncate"
            style={{ color: "var(--foreground)" }}
          >
            {materia.nombre}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              {cfg.label}
            </span>
            {materia.periodo_cursado && (
              <span
                className="text-xs"
                style={{ color: "var(--foreground-subtle)" }}
              >
                {materia.periodo_cursado}
              </span>
            )}
            {proximaFecha && (
              <span
                className="text-xs flex items-center gap-1 ml-auto"
                style={{ color: "var(--foreground-muted)" }}
              >
                <Clock size={10} />
                {format(parseISO(proximaFecha.fecha), "d MMM", { locale: es })}
              </span>
            )}
          </div>
        </div>

        {/* Nota actual */}
        <div className="flex items-center gap-2">
          {resultado.promedio_actual > 0 && (
            <span
              className="text-lg font-semibold hidden sm:block"
              style={{ color: grafColor }}
            >
              {resultado.promedio_actual.toFixed(1)}
            </span>
          )}
          {isExpanded
            ? <ChevronUp size={16} style={{ color: "var(--foreground-subtle)" }} />
            : <ChevronDown size={16} style={{ color: "var(--foreground-subtle)" }} />
          }
        </div>
      </div>

      {/* ── Contenido expandido ── */}
      {isExpanded && (
        <div
          className="border-t px-5 py-4 animate-fade-in"
          style={{ borderColor: "var(--color-card-border)" }}
        >
          <div className="flex flex-col sm:flex-row gap-5">

            {/* Gráfico circular */}
            <div className="w-full sm:w-24 h-24 relative flex-shrink-0 mx-auto sm:mx-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donaData}
                    innerRadius={30}
                    outerRadius={44}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    stroke="none"
                  >
                    <Cell fill={grafColor} />
                    <Cell fill="var(--background-alt)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span
                  className="text-lg font-semibold"
                  style={{ color: grafColor }}
                >
                  {resultado.promedio_actual > 0 ? resultado.promedio_actual.toFixed(1) : "—"}
                </span>
                <span
                  className="text-xs"
                  style={{ color: "var(--foreground-subtle)" }}
                >
                  / 10
                </span>
              </div>
            </div>

            {/* Evaluaciones */}
            <div className="flex-1 min-w-0">
              {/* Mensaje de estado */}
              <div
                className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg"
                style={{ background: cfg.bg }}
              >
                <IconEstado size={13} style={{ color: cfg.color }} />
                <span
                  className="text-xs font-medium"
                  style={{ color: cfg.color }}
                >
                  {resultado.puede_promocionar
                    ? "Camino a la promoción"
                    : resultado.puede_aprobar
                    ? "Cursada regular — aprobás"
                    : resultado.promedio_actual > 0
                    ? "Promedio por debajo de la aprobación"
                    : "Sin calificaciones aún"}
                </span>
              </div>

              {/* Lista de evaluaciones */}
              <div className="space-y-1.5 mb-3">
                {materia.evaluaciones.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{ background: "var(--background-alt)" }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="text-xs font-medium uppercase px-1.5 py-0.5 rounded"
                        style={{
                          background: "var(--color-card-border)",
                          color: "var(--foreground-muted)",
                          fontSize: "10px",
                        }}
                      >
                        {ev.tipo}
                      </span>
                      <span
                        className="text-sm truncate"
                        style={{ color: "var(--foreground)" }}
                      >
                        {ev.nombre}
                      </span>
                      {ev.fecha && (
                        <span
                          className="text-xs hidden sm:inline"
                          style={{ color: "var(--foreground-subtle)" }}
                        >
                          {format(parseISO(ev.fecha), "d MMM", { locale: es })}
                        </span>
                      )}
                    </div>

                    {/* Edición inline de nota */}
                    {editandoId === ev.id && onEditarNota ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={10}
                          step={0.5}
                          value={valorEdit}
                          onChange={(e) => setValorEdit(e.target.value)}
                          className="w-14 text-right text-sm font-semibold rounded-lg px-2 py-0.5 border"
                          style={{
                            background: "var(--color-card)",
                            borderColor: "var(--color-primary)",
                            color: "var(--foreground)",
                            outline: "none",
                          }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmarEdicion(ev.id);
                            if (e.key === "Escape") setEditandoId(null);
                          }}
                        />
                        <button
                          onClick={() => confirmarEdicion(ev.id)}
                          className="text-xs font-semibold px-2 py-1 rounded-lg transition-opacity hover:opacity-75"
                          style={{ background: "var(--color-primary)", color: "white" }}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setEditandoId(null)}
                          className="text-xs px-2 py-1 rounded-lg transition-opacity hover:opacity-75"
                          style={{ background: "var(--color-card-border)", color: "var(--foreground)" }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => iniciarEdicion(ev.id, ev.nota)}
                        className="text-sm font-semibold min-w-8 text-right transition-opacity hover:opacity-70"
                        style={{
                          color: ev.nota !== undefined && ev.nota !== null
                            ? ev.nota >= (materia.configuracion_nota.nota_promocionar ?? 7)
                              ? "var(--color-primary)"
                              : ev.nota >= (materia.configuracion_nota.nota_aprobar ?? 4)
                              ? "var(--color-accent)"
                              : "var(--color-alert)"
                            : "var(--foreground-subtle)",
                        }}
                        title="Clic para editar nota"
                        aria-label={`Editar nota de ${ev.nombre}`}
                      >
                        {ev.nota !== undefined && ev.nota !== null ? ev.nota : "—"}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Reglas */}
              <div
                className="flex flex-wrap gap-2 text-xs"
                style={{ color: "var(--foreground-subtle)" }}
              >
                <span>
                  Aprueba: <strong style={{ color: "var(--foreground-muted)" }}>{materia.configuracion_nota.nota_aprobar}</strong>
                </span>
                <span>·</span>
                <span>
                  Promociona: <strong style={{ color: "var(--foreground-muted)" }}>{materia.configuracion_nota.nota_promocionar}</strong>
                </span>
                <span>·</span>
                <span>{resumenFormula(materia.configuracion_nota)}</span>
              </div>

              {/* Ver detalle */}
              {onAbrirDetalle && (
                <button
                  onClick={() => onAbrirDetalle(materia.id)}
                  className="mt-3 text-xs font-medium hover:underline"
                  style={{ color: "var(--color-primary)" }}
                >
                  Ver detalle completo →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
