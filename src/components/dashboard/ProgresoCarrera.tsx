"use client";

// src/components/dashboard/ProgresoCarrera.tsx
// Gráfico de progreso de carrera con dona (Recharts)

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Materia, Carrera } from "@/types";
import {
  calcularPorcentajeAvance,
  calcularPromedioGeneral,
} from "@/lib/calculo-notas";
import { Award, GraduationCap } from "lucide-react";

interface ProgresoCarreraProps {
  materias: Materia[];
  carrera: Carrera | null;
}

const COLORES_ESTADOS = {
  aprobada: "var(--estado-aprobada)",
  regular: "var(--estado-regular)",
  cursando: "var(--estado-cursando)",
  libre: "var(--estado-libre)",
  pendiente: "var(--color-card-border)",
};

export function ProgresoCarrera({ materias, carrera }: ProgresoCarreraProps) {
  const porcentaje = calcularPorcentajeAvance(
    materias,
    carrera?.total_materias_plan
  );
  const promedio = calcularPromedioGeneral(materias);

  const aprobadas = materias.filter((m) => m.estado === "aprobada").length;
  const cursando = materias.filter((m) => m.estado === "cursando").length;
  const pendientes = materias.filter((m) => m.estado === "pendiente").length;

  const donaData = [
    { name: "Aprobadas", value: aprobadas, color: COLORES_ESTADOS.aprobada },
    { name: "Cursando", value: cursando, color: COLORES_ESTADOS.cursando },
    { name: "Pendientes", value: pendientes, color: COLORES_ESTADOS.pendiente },
  ].filter((d) => d.value > 0);

  const totalMaterias = aprobadas + cursando + pendientes;

  if (totalMaterias === 0) {
    return (
      <div
        className="rounded-2xl p-6 border flex flex-col items-center justify-center text-center gap-3 min-h-40"
        style={{
          background: "var(--color-card)",
          borderColor: "var(--color-card-border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <GraduationCap size={28} style={{ color: "var(--foreground-subtle)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>
          Cargá tus materias para ver el progreso
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-6 border"
      style={{
        background: "var(--color-card)",
        borderColor: "var(--color-card-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3
            className="font-semibold text-base"
            style={{ color: "var(--foreground)" }}
          >
            Progreso de carrera
          </h3>
          {carrera && (
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--foreground-muted)" }}
            >
              {carrera.nombre}
            </p>
          )}
        </div>
        <div className="text-right">
          <div
            className="text-3xl font-semibold"
            style={{ color: "var(--color-primary)" }}
          >
            {porcentaje}%
          </div>
          <div
            className="text-xs"
            style={{ color: "var(--foreground-muted)" }}
          >
            completado
          </div>
        </div>
      </div>

      {/* Barra de progreso — delgada y suave */}
      <div
        className="w-full h-1.5 rounded-full mb-5 overflow-hidden"
        style={{ background: "var(--background-alt)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${porcentaje}%`,
            background: "var(--color-primary)",
          }}
        />
      </div>

      <div className="flex gap-4">
        {/* Dona */}
        <div className="w-32 h-32 flex-shrink-0 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donaData}
                innerRadius={38}
                outerRadius={56}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
              >
                {donaData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(val, name) => [`${val} materias`, name]}
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-card-border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "var(--foreground)",
                  boxShadow: "var(--shadow-md)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span
              className="text-lg font-semibold leading-none"
              style={{ color: "var(--foreground)" }}
            >
              {aprobadas}
            </span>
            <span
              className="text-xs"
              style={{ color: "var(--foreground-subtle)" }}
            >
              aprob.
            </span>
          </div>
        </div>

        {/* Leyenda y promedio */}
        <div className="flex-1 flex flex-col justify-center gap-2">
          {donaData.map((item) => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: item.color }}
                />
                <span
                  className="text-sm"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  {item.name}
                </span>
              </div>
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                {item.value}
              </span>
            </div>
          ))}

          {promedio > 0 && (
            <div
              className="mt-2 pt-2 border-t flex items-center justify-between"
              style={{ borderColor: "var(--color-card-border)" }}
            >
              <div className="flex items-center gap-2">
                <Award size={12} style={{ color: "var(--color-accent)" }} />
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Promedio gral.
                </span>
              </div>
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--color-accent-dark)" }}
              >
                {promedio.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
