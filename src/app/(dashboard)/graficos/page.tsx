"use client";

// src/app/(dashboard)/graficos/page.tsx
// Varios gráficos con los datos ya cargados: distribución de estados,
// materias por período cursado, distribución de notas, y comparación
// de avance entre carreras (útil en vista global).

import { useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { BarChart3, TrendingUp } from "lucide-react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useMaterias } from "@/hooks/useMaterias";
import { useCarreraActivaContext } from "@/components/dashboard/CarreraActivaProvider";
import { calcularPorcentajeAvance, calcularPromedioGeneral } from "@/lib/calculo-notas";
import { EstadoMateria } from "@/types";

const ESTADO_COLOR: Record<EstadoMateria, string> = {
  aprobada: "var(--estado-aprobada)",
  cursando: "var(--estado-cursando)",
  regular: "var(--estado-regular)",
  libre: "var(--estado-libre)",
  pendiente: "var(--color-card-border)",
};

const ESTADO_LABEL: Record<EstadoMateria, string> = {
  aprobada: "Aprobadas",
  cursando: "Cursando",
  regular: "Regulares",
  libre: "Libres",
  pendiente: "Pendientes",
};

function ChartCard({ titulo, icono: Icono, children, vacio }: {
  titulo: string;
  icono: typeof BarChart3;
  children: React.ReactNode;
  vacio?: boolean;
}) {
  return (
    <div className="rounded-2xl p-5 border" style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
      <h2 className="text-sm font-bold flex items-center gap-2 mb-4" style={{ color: "var(--foreground)" }}>
        <Icono size={15} style={{ color: "var(--color-primary)" }} />
        {titulo}
      </h2>
      {vacio ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--foreground-subtle)" }}>
          No hay datos suficientes todavía
        </p>
      ) : children}
    </div>
  );
}

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-card-border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--foreground)",
};

export default function GraficosPage() {
  const { user } = useAuthContext();
  const { materias, loading } = useMaterias(user?.uid ?? null);
  const { carreras, carreraActivaId, carreraActiva } = useCarreraActivaContext();

  const materiasFiltradas = carreraActivaId
    ? materias.filter((m) => m.carreras_vinculadas?.includes(carreraActivaId))
    : materias;

  const dataEstados = useMemo(() => {
    const conteo: Record<string, number> = {};
    materiasFiltradas.forEach((m) => { conteo[m.estado] = (conteo[m.estado] ?? 0) + 1; });
    return (Object.keys(conteo) as EstadoMateria[])
      .map((estado) => ({ estado, label: ESTADO_LABEL[estado], value: conteo[estado] }))
      .filter((d) => d.value > 0);
  }, [materiasFiltradas]);

  const dataPeriodos = useMemo(() => {
    const conteo = new Map<string, number>();
    materiasFiltradas
      .filter((m) => m.estado === "aprobada" && m.periodo_cursado)
      .forEach((m) => {
        const p = m.periodo_cursado!;
        conteo.set(p, (conteo.get(p) ?? 0) + 1);
      });
    return Array.from(conteo.entries())
      .map(([periodo, cantidad]) => ({ periodo, cantidad }))
      .sort((a, b) => a.periodo.localeCompare(b.periodo));
  }, [materiasFiltradas]);

  const dataNotas = useMemo(() => {
    const buckets = [
      { rango: "0-3", min: 0, max: 4, cantidad: 0 },
      { rango: "4-5", min: 4, max: 6, cantidad: 0 },
      { rango: "6-7", min: 6, max: 8, cantidad: 0 },
      { rango: "8-10", min: 8, max: 10.01, cantidad: 0 },
    ];
    materiasFiltradas.forEach((m) => {
      m.evaluaciones.forEach((ev) => {
        if (ev.nota === null || ev.nota === undefined) return;
        const bucket = buckets.find((b) => ev.nota! >= b.min && ev.nota! < b.max);
        if (bucket) bucket.cantidad++;
      });
    });
    return buckets;
  }, [materiasFiltradas]);

  const dataCarreras = useMemo(() => {
    return carreras.map((c) => {
      const materiasCarrera = materias.filter((m) => m.carreras_vinculadas?.includes(c.id));
      return {
        nombre: c.nombre.length > 18 ? c.nombre.slice(0, 18) + "…" : c.nombre,
        avance: calcularPorcentajeAvance(materiasCarrera, c.total_materias_plan),
        promedio: calcularPromedioGeneral(materiasCarrera),
      };
    });
  }, [carreras, materias]);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
            <BarChart3 size={22} style={{ color: "var(--color-primary)" }} />
            Gráficos
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
            {carreraActiva ? carreraActiva.nombre : "Vista global"}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-64 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ChartCard titulo="Materias por estado" icono={BarChart3} vacio={dataEstados.length === 0}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={dataEstados} dataKey="value" nameKey="label" innerRadius={50} outerRadius={80} stroke="none">
                    {dataEstados.map((d) => <Cell key={d.estado} fill={ESTADO_COLOR[d.estado]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${v} materias`, n]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard titulo="Distribución de notas" icono={TrendingUp} vacio={dataNotas.every((b) => b.cantidad === 0)}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dataNotas}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-card-border)" />
                  <XAxis dataKey="rango" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} evaluaciones`, ""]} />
                  <Bar dataKey="cantidad" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard titulo="Materias aprobadas por período" icono={TrendingUp} vacio={dataPeriodos.length === 0}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dataPeriodos}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-card-border)" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} materias`, ""]} />
                  <Bar dataKey="cantidad" fill="var(--color-secondary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard titulo="Avance por carrera" icono={BarChart3} vacio={dataCarreras.length === 0}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dataCarreras} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-card-border)" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="nombre" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Avance"]} />
                  <Bar dataKey="avance" fill="var(--color-accent)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}

        <p className="text-xs text-center" style={{ color: "var(--foreground-subtle)" }}>
          "Materias por período" y "distribución de notas" van a mejorar cuando la extensión
          pueda traer el historial completo de actos académicos desde SIU Guaraní.
        </p>
      </div>
    </div>
  );
}
