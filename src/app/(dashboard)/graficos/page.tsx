"use client";

// src/app/(dashboard)/graficos/page.tsx
// La carrera en números. Va de lo general a lo particular:
//   1. Cuatro cifras de un vistazo.
//   2. La carrera en el tiempo: cuánto se aprobó cada año y cómo fue el promedio.
//   3. Dónde está parado hoy: avance por año del plan y materias por estado.
//   4. Detalle: reparto de notas, cómo se aprobó, regularidades, carreras.
//
// Reglas de los gráficos: una sola escala por gráfico, el color nunca es lo
// único que distingue (siempre hay etiqueta con el número al lado) y el texto
// usa los colores de texto, no los de la serie.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { BarChart3, ChevronRight, Hourglass, RefreshCw } from "lucide-react";
import { useMaterias } from "@/hooks/useMaterias";
import { useCarreraActivaContext } from "@/components/dashboard/CarreraActivaProvider";
import { EmptyState, PageHeader } from "@/components/ui/kit";
import { calcularPorcentajeAvance, calcularPromedioGeneral } from "@/lib/calculo-notas";
import {
  avancePorAñoDelPlan, formasDeAprobar, lineaDeTiempo, notaFinal, promedioConAplazos,
  regularidadesPorVencer,
} from "@/lib/estadisticas";
import { ESTADOS, ESTADOS_ORDEN, formatearNota } from "@/lib/estados";
import { formatearFechaCorta } from "@/lib/fechas";

// ── Piezas ──────────────────────────────────────────────────

function ChartCard({ titulo, ayuda, children, vacio, acciones, className = "" }: {
  titulo: string;
  ayuda?: string;
  children: React.ReactNode;
  /** Qué falta cargar para que este gráfico tenga algo que mostrar */
  vacio?: string | false;
  acciones?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card card-pad ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="section-title">{titulo}</h2>
          {ayuda && <p className="text-sm text-foreground-muted mt-0.5">{ayuda}</p>}
        </div>
        {acciones}
      </div>
      {vacio ? <p className="text-sm text-center py-10 text-foreground-subtle">{vacio}</p> : children}
    </section>
  );
}

function Cifra({ valor, etiqueta, detalle }: { valor: string | number; etiqueta: string; detalle?: string }) {
  return (
    <div className="card px-4 py-3.5">
      <p className="text-xs font-bold text-foreground-muted">{etiqueta}</p>
      <p className="font-display tabular text-3xl font-semibold text-foreground leading-tight mt-1">{valor}</p>
      {detalle && <p className="text-xs text-foreground-subtle mt-0.5">{detalle}</p>}
    </div>
  );
}

/** Referencia de color + nombre + número: la identidad nunca depende solo del color. */
function Leyenda({ items }: { items: { color: string; label: string; valor?: number }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-foreground-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{ background: i.color }} aria-hidden />
          {i.label}
          {i.valor !== undefined && <span className="font-bold text-foreground tabular">{i.valor}</span>}
        </li>
      ))}
    </ul>
  );
}

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-card-border)",
  borderRadius: "10px",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--foreground)",
  boxShadow: "var(--shadow-md)",
};
const itemStyle = { color: "var(--foreground)" };
const tick = { fontSize: 11, fill: "var(--foreground-muted)" };
const ejeX = { tick, tickLine: false, axisLine: { stroke: "var(--color-card-border)" } };
const ejeY = { tick, tickLine: false, axisLine: false, allowDecimals: false, width: 28 };
const cursorBarra = { fill: "var(--background-alt)" };
const cursorLinea = { stroke: "var(--foreground-subtle)", strokeWidth: 1 };
const margen = { top: 8, right: 8, left: 0, bottom: 0 };

const plural = (n: number, uno: string, muchos: string) => `${n} ${n === 1 ? uno : muchos}`;

// ── Página ──────────────────────────────────────────────────

export default function GraficosPage() {
  const { materias, loading } = useMaterias();
  const { carreras, carreraActiva, materiasVisibles } = useCarreraActivaContext();
  const [vistaTiempo, setVistaTiempo] = useState<"acumulado" | "anual">("acumulado");

  const datos = useMemo(() => {
    const aprobadas = materiasVisibles.filter((m) => m.estado === "aprobada");
    const { puntos, sinFecha } = lineaDeTiempo(materiasVisibles);
    const mejor = puntos.reduce<(typeof puntos)[number] | null>(
      (max, p) => (p.aprobadas > (max?.aprobadas ?? 0) ? p : max),
      null
    );

    // Una barra por nota final de materia (1 a 10).
    const notas = Array.from({ length: 10 }, (_, i) => ({ nota: String(i + 1), cantidad: 0 }));
    let totalNotas = 0;
    aprobadas.forEach((m) => {
      const nota = notaFinal(m);
      if (nota === null) return;
      notas[Math.min(10, Math.max(1, Math.round(nota))) - 1].cantidad++;
      totalNotas++;
    });

    return {
      aprobadas: aprobadas.length,
      total: carreraActiva?.total_materias_plan ?? materiasVisibles.length,
      porcentaje: Math.min(100, calcularPorcentajeAvance(materiasVisibles, carreraActiva?.total_materias_plan)),
      promedio: calcularPromedioGeneral(materiasVisibles),
      conAplazos: promedioConAplazos(materiasVisibles),
      puntos,
      sinFecha,
      mejor,
      ritmo: puntos.length > 0 ? (aprobadas.length - sinFecha) / puntos.length : 0,
      porAño: avancePorAñoDelPlan(materiasVisibles),
      estados: ESTADOS_ORDEN
        .map((estado) => ({
          estado,
          label: ESTADOS[estado].plural,
          value: materiasVisibles.filter((m) => m.estado === estado).length,
        }))
        .filter((d) => d.value > 0),
      notas,
      totalNotas,
      formas: formasDeAprobar(materiasVisibles),
      regularidades: regularidadesPorVencer(materiasVisibles),
      hayHistoria: materiasVisibles.some((m) => (m.actos_academicos?.length ?? 0) > 0),
      vieneDeSiu: materiasVisibles.some((m) => m.evaluaciones.some((e) => e.nombre === "Nota SIU Guaraní")),
    };
  }, [materiasVisibles, carreraActiva]);

  const dataCarreras = useMemo(
    () =>
      carreras.map((c) => {
        const suyas = materias.filter((m) => m.carreras_vinculadas?.includes(c.id));
        return {
          id: c.id,
          nombre: c.nombre,
          avance: Math.min(100, calcularPorcentajeAvance(suyas, c.total_materias_plan)),
          color: c.color ?? "var(--color-primary)",
        };
      }),
    [carreras, materias]
  );

  const subtitulo = carreraActiva ? carreraActiva.nombre : carreras.length > 1 ? "Todas tus carreras" : undefined;

  if (!loading && materiasVisibles.length === 0) {
    return (
      <main className="page">
        <PageHeader titulo="Gráficos" subtitulo={subtitulo} />
        <EmptyState
          icono={<BarChart3 size={22} />}
          titulo="Todavía no hay datos para graficar"
          texto="Los gráficos se arman solos con tus materias y tus notas."
        >
          <Link href="/materias" className="btn btn-primary">Ir a mis materias</Link>
        </EmptyState>
      </main>
    );
  }

  const { puntos } = datos;
  const hayTiempo = puntos.length > 0;
  const desde = puntos[0]?.año;
  const hasta = puntos[puntos.length - 1]?.año;
  const puntosConPromedio = puntos.filter((p) => p.promedioAcumulado !== null);
  const promedios = puntosConPromedio.map((p) => p.promedioAcumulado as number);
  // El eje del promedio no arranca en 0: lo que importa es la variación, y
  // entre 0 y 10 una diferencia de medio punto no se vería.
  const pisoPromedio = promedios.length > 0 ? Math.max(0, Math.floor(Math.min(...promedios)) - 1) : 0;
  const formasConDato = datos.formas.promocion + datos.formas.examen;

  return (
    <main className="page space-y-4">
      <PageHeader titulo="Gráficos" subtitulo={subtitulo} />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 !mt-0">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-72" />)}
        </div>
      ) : (
        <>
          {/* Lo que falta se completa solo al volver a sincronizar: va primero
              porque explica por qué algunos gráficos de abajo están vacíos. */}
          {datos.vieneDeSiu && !datos.hayHistoria && (
            <div className="notice items-center !mt-0">
              <RefreshCw size={17} className="flex-shrink-0 text-primary" />
              <span className="flex-1">
                <strong className="text-foreground">Hay más para ver.</strong> Volvé a sincronizar con SIU Guaraní y
                vas a tener {hayTiempo ? "" : "tu carrera año por año, "}cómo aprobaste cada materia, tu promedio con
                aplazos y cuándo vencen tus regularidades.
              </span>
              <Link href="/materias/importar" className="btn btn-secondary btn-sm flex-shrink-0">Sincronizar</Link>
            </div>
          )}

          {/* ── 1. De un vistazo ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Cifra
              etiqueta="Aprobadas"
              valor={`${datos.aprobadas} de ${datos.total}`}
              detalle={`${datos.porcentaje}% de la carrera`}
            />
            <Cifra
              etiqueta="Promedio"
              valor={datos.promedio > 0 ? formatearNota(datos.promedio) : "—"}
              detalle={
                datos.conAplazos !== null
                  ? `${formatearNota(datos.conAplazos)} contando aplazos`
                  : datos.promedio > 0 ? "de tus materias aprobadas" : "todavía sin notas"
              }
            />
            <Cifra
              etiqueta="Tu mejor año"
              valor={datos.mejor ? datos.mejor.año : "—"}
              detalle={datos.mejor ? plural(datos.mejor.aprobadas, "materia aprobada", "materias aprobadas") : "sin fechas todavía"}
            />
            <Cifra
              etiqueta="Tu ritmo"
              valor={hayTiempo ? formatearNota(datos.ritmo, 1) : "—"}
              detalle={hayTiempo ? `materias por año, ${desde === hasta ? `en ${desde}` : `de ${desde} a ${hasta}`}` : "sin fechas todavía"}
            />
          </div>

          {/* ── 2. La carrera en el tiempo ── */}
          <ChartCard
            titulo="Tu carrera en el tiempo"
            ayuda={
              vistaTiempo === "acumulado"
                ? "Materias aprobadas acumuladas, año por año."
                : "Cuántas materias aprobaste cada año."
            }
            vacio={!hayTiempo && "Cuando tus materias aprobadas tengan fecha, acá vas a ver cómo fue avanzando tu carrera."}
            acciones={
              hayTiempo && (
                <div className="flex gap-1.5 flex-shrink-0" role="group" aria-label="Cómo ver el gráfico">
                  <button type="button" className="chip" aria-pressed={vistaTiempo === "acumulado"} onClick={() => setVistaTiempo("acumulado")}>
                    Acumulado
                  </button>
                  <button type="button" className="chip" aria-pressed={vistaTiempo === "anual"} onClick={() => setVistaTiempo("anual")}>
                    Por año
                  </button>
                </div>
              )
            }
          >
            <div role="img" aria-label={`Materias aprobadas por año: ${puntos.map((p) => `${p.año}, ${p.aprobadas}`).join("; ")}`}>
              <ResponsiveContainer width="100%" height={240}>
                {vistaTiempo === "acumulado" ? (
                  <AreaChart data={puntos} margin={margen}>
                    <CartesianGrid vertical={false} stroke="var(--color-card-border)" />
                    <XAxis dataKey="año" {...ejeX} />
                    <YAxis {...ejeY} domain={[0, Math.max(datos.total, datos.aprobadas)]} />
                    <Tooltip
                      cursor={cursorLinea}
                      contentStyle={tooltipStyle}
                      itemStyle={itemStyle}
                      formatter={(v, _n, item) => [
                        `${v} en total · ${plural((item.payload as { aprobadas: number }).aprobadas, "aprobada", "aprobadas")} ese año`,
                        "",
                      ]}
                      separator=""
                    />
                    <ReferenceLine
                      y={datos.total}
                      stroke="var(--foreground-subtle)"
                      strokeDasharray="4 4"
                      label={{ value: `Toda la carrera: ${datos.total}`, position: "insideTopLeft", fontSize: 11, fill: "var(--foreground-muted)" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="acumuladas"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      fill="var(--color-primary)"
                      fillOpacity={0.14}
                      dot={{ r: 4, fill: "var(--color-primary)", stroke: "var(--color-card)", strokeWidth: 2 }}
                      activeDot={{ r: 6, stroke: "var(--color-card)", strokeWidth: 2 }}
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={puntos} margin={margen}>
                    <CartesianGrid vertical={false} stroke="var(--color-card-border)" />
                    <XAxis dataKey="año" {...ejeX} />
                    <YAxis {...ejeY} />
                    <Tooltip
                      cursor={cursorBarra}
                      contentStyle={tooltipStyle}
                      itemStyle={itemStyle}
                      formatter={(v) => [plural(Number(v), "materia aprobada", "materias aprobadas"), ""]}
                      separator=""
                    />
                    <Bar dataKey="aprobadas" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={56} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            {datos.sinFecha > 0 && (
              <p className="hint">
                {datos.sinFecha === 1
                  ? "Hay 1 materia aprobada sin fecha, que no aparece acá."
                  : `Hay ${datos.sinFecha} materias aprobadas sin fecha, que no aparecen acá.`}{" "}
                {datos.vieneDeSiu && !datos.hayHistoria
                  ? "Al volver a sincronizar con SIU Guaraní se completan solas."
                  : "Cargale la fecha a su nota para sumarla."}
              </p>
            )}
          </ChartCard>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartCard
              titulo="Tu promedio en el tiempo"
              ayuda="El promedio general que tenías al cierre de cada año."
              vacio={puntosConPromedio.length < 2 && "Hace falta tener notas con fecha en al menos dos años distintos."}
            >
              <div role="img" aria-label={`Promedio por año: ${puntosConPromedio.map((p) => `${p.año}, ${p.promedioAcumulado}`).join("; ")}`}>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={puntosConPromedio} margin={margen}>
                    <CartesianGrid vertical={false} stroke="var(--color-card-border)" />
                    <XAxis dataKey="año" {...ejeX} />
                    <YAxis {...ejeY} allowDecimals domain={[pisoPromedio, 10]} tickCount={Math.min(6, 10 - pisoPromedio + 1)} />
                    <Tooltip
                      cursor={cursorLinea}
                      contentStyle={tooltipStyle}
                      itemStyle={itemStyle}
                      formatter={(v, _n, item) => {
                        const delAño = (item.payload as { promedioAño: number | null }).promedioAño;
                        return [
                          `Promedio general ${formatearNota(Number(v))}${delAño !== null ? ` · ese año sacaste ${formatearNota(delAño)}` : ""}`,
                          "",
                        ];
                      }}
                      separator=""
                    />
                    <Line
                      type="monotone"
                      dataKey="promedioAcumulado"
                      stroke="var(--color-accent)"
                      strokeWidth={2}
                      dot={{ r: 4, fill: "var(--color-accent)", stroke: "var(--color-card)", strokeWidth: 2 }}
                      activeDot={{ r: 6, stroke: "var(--color-card)", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {pisoPromedio > 0 && (
                <p className="hint">El eje arranca en {pisoPromedio} para que se note la variación.</p>
              )}
            </ChartCard>

            <ChartCard
              titulo="Tus notas finales"
              ayuda={datos.totalNotas > 0 ? `Con qué nota aprobaste tus ${plural(datos.totalNotas, "materia", "materias")}.` : "Con qué nota aprobaste cada materia."}
              vacio={datos.totalNotas === 0 && "Cargá la nota de tus materias aprobadas para ver este gráfico."}
            >
              <div role="img" aria-label={`Notas finales: ${datos.notas.filter((b) => b.cantidad > 0).map((b) => `${b.cantidad} con ${b.nota}`).join("; ")}`}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={datos.notas} margin={margen}>
                    <CartesianGrid vertical={false} stroke="var(--color-card-border)" />
                    <XAxis dataKey="nota" {...ejeX} />
                    <YAxis {...ejeY} />
                    <Tooltip
                      cursor={cursorBarra}
                      contentStyle={tooltipStyle}
                      itemStyle={itemStyle}
                      labelFormatter={(l) => `Nota ${l}`}
                      formatter={(v) => [plural(Number(v), "materia", "materias"), ""]}
                      separator=""
                    />
                    {/* Un solo color: la altura ya dice cuántas, y el eje dice qué nota. */}
                    <Bar dataKey="cantidad" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          {/* ── 3. Dónde estás hoy ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartCard titulo="Avance por año del plan" ayuda="Cuánto tenés hecho de cada año de la carrera.">
              <ul className="space-y-3.5">
                {datos.porAño.map((a) => (
                  <li key={a.año ?? "sin"}>
                    <div className="flex items-baseline justify-between gap-3 text-sm mb-1.5">
                      <span className="font-semibold text-foreground">{a.año === null ? "Sin año asignado" : `${a.año}° año`}</span>
                      <span className="text-xs text-foreground-muted tabular">
                        {a.aprobadas === a.total ? "Completo" : `${a.aprobadas} de ${a.total}`}
                      </span>
                    </div>
                    {/* Barra segmentada: cada tramo es proporcional y deja 2px de aire con el siguiente */}
                    <div
                      className="flex gap-0.5 h-2.5"
                      role="img"
                      aria-label={`${a.aprobadas} aprobadas, ${a.regulares} regulares, ${a.cursando} cursando, ${a.restantes} sin cursar, de ${a.total}`}
                    >
                      {([
                        [a.aprobadas, ESTADOS.aprobada.color],
                        [a.regulares, ESTADOS.regular.color],
                        [a.cursando, ESTADOS.cursando.color],
                        [a.restantes, "var(--color-card-border)"],
                      ] as const)
                        .filter(([n]) => n > 0)
                        .map(([n, color], i) => (
                          <span key={i} className="rounded-full" style={{ flex: n, background: color }} />
                        ))}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-3 border-t border-card-border">
                <Leyenda
                  items={[
                    { color: ESTADOS.aprobada.color, label: "Aprobadas" },
                    { color: ESTADOS.regular.color, label: "Regulares" },
                    { color: ESTADOS.cursando.color, label: "Cursando" },
                    { color: "var(--color-card-border)", label: "Sin cursar" },
                  ]}
                />
              </div>
            </ChartCard>

            <ChartCard titulo="Tus materias por estado" ayuda="Tocá un estado para ver esas materias.">
              <div className="flex items-center gap-4">
                <div className="w-36 h-36 flex-shrink-0" role="img" aria-label={datos.estados.map((d) => `${d.value} ${d.label}`).join(", ")}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={datos.estados} dataKey="value" nameKey="label" innerRadius={42} outerRadius={68}
                        paddingAngle={datos.estados.length > 1 ? 2 : 0} stroke="none" startAngle={90} endAngle={-270}>
                        {datos.estados.map((d) => <Cell key={d.estado} fill={ESTADOS[d.estado].color} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} itemStyle={itemStyle}
                        formatter={(v, n) => [plural(Number(v), "materia", "materias"), n]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="flex-1 min-w-0 -my-1">
                  {datos.estados.map((d) => (
                    <li key={d.estado}>
                      <Link
                        href={`/materias?estado=${d.estado}`}
                        className="row-hover flex items-center gap-2 text-sm -mx-2 px-2 py-1.5 rounded-[var(--radius-sm)]"
                      >
                        <span className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{ background: ESTADOS[d.estado].color }} aria-hidden />
                        <span className="flex-1 text-foreground-muted truncate">{d.label}</span>
                        <span className="font-bold text-foreground tabular">{d.value}</span>
                        <ChevronRight size={14} className="text-foreground-subtle" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </ChartCard>
          </div>

          {/* ── 4. Detalle (solo lo que tiene datos) ── */}
          {(datos.regularidades.length > 0 || formasConDato > 0 || dataCarreras.length > 1) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {datos.regularidades.length > 0 && (
                <ChartCard titulo="Regularidades por vencer" ayuda="Si vence, hay que volver a cursar la materia.">
                  <ul className="divide-y divide-card-border -my-2">
                    {datos.regularidades.map((r) => {
                      const urgente = r.dias <= 90;
                      return (
                        <li key={r.materiaId}>
                          <Link href={`/materias/${r.materiaId}`} className="row-hover flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-[var(--radius-sm)]">
                            <Hourglass size={16} className={`flex-shrink-0 ${urgente ? "text-alert" : "text-foreground-subtle"}`} />
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-bold text-foreground truncate">{r.nombre}</span>
                              <span className="block text-xs text-foreground-subtle">Vence el {formatearFechaCorta(r.vence)} de {r.vence.slice(0, 4)}</span>
                            </span>
                            <span
                              className="badge flex-shrink-0"
                              style={urgente ? { background: "var(--estado-libre-bg)", color: "var(--color-alert)" } : undefined}
                            >
                              {r.dias < 0 ? "Vencida" : r.dias === 0 ? "Vence hoy" : r.dias < 60 ? `${r.dias} días` : `${Math.round(r.dias / 30)} meses`}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </ChartCard>
              )}

              {formasConDato > 0 && (
                <ChartCard titulo="Cómo aprobaste" ayuda={`Sobre ${plural(formasConDato, "materia", "materias")} con historia académica.`}>
                  <div
                    className="flex gap-0.5 h-3"
                    role="img"
                    aria-label={`${datos.formas.promocion} por promoción, ${datos.formas.examen} por examen final`}
                  >
                    {datos.formas.promocion > 0 && <span className="rounded-full" style={{ flex: datos.formas.promocion, background: "var(--color-primary)" }} />}
                    {datos.formas.examen > 0 && <span className="rounded-full" style={{ flex: datos.formas.examen, background: "var(--color-accent)" }} />}
                  </div>
                  <div className="mt-3">
                    <Leyenda
                      items={[
                        { color: "var(--color-primary)", label: "Por promoción", valor: datos.formas.promocion },
                        { color: "var(--color-accent)", label: "Por examen final", valor: datos.formas.examen },
                      ]}
                    />
                  </div>
                </ChartCard>
              )}

              {dataCarreras.length > 1 && (
                <ChartCard titulo="Avance por carrera" ayuda="Porcentaje de materias aprobadas en cada una.">
                  <ul className="space-y-4 py-1">
                    {dataCarreras.map((c) => (
                      <li key={c.id}>
                        <div className="flex items-baseline justify-between gap-3 text-sm mb-1.5">
                          <span className="font-semibold text-foreground truncate flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} aria-hidden />
                            <span className="truncate">{c.nombre}</span>
                          </span>
                          <span className="font-display tabular font-semibold text-foreground">{c.avance}%</span>
                        </div>
                        <div className="progress" role="progressbar" aria-valuenow={c.avance} aria-valuemin={0} aria-valuemax={100} aria-label={c.nombre}>
                          <span style={{ width: `${c.avance}%`, background: c.color }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </ChartCard>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
