"use client";

// src/app/(dashboard)/materias/page.tsx
// Todas las materias de la carrera que se está mirando: buscador, filtro por
// estado y la lista agrupada (primero lo que se está cursando).

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookOpen, Plus, RefreshCw, Search, X } from "lucide-react";
import { useMaterias } from "@/hooks/useMaterias";
import { useCarreraActivaContext } from "@/components/dashboard/CarreraActivaProvider";
import { MateriaFila } from "@/components/materias/MateriaFila";
import { EmptyState, Esqueleto, PageHeader } from "@/components/ui/kit";
import { ESTADOS, ESTADOS_ORDEN } from "@/lib/estados";
import { normalizarTexto } from "@/lib/catalogo";
import { EstadoMateria } from "@/types";

type Filtro = EstadoMateria | "todas";

// useSearchParams necesita un límite de Suspense para que la página se pueda prerenderizar.
export default function MateriasPage() {
  return (
    <Suspense fallback={null}>
      <MateriasContenido />
    </Suspense>
  );
}

function MateriasContenido() {
  const { loading } = useMaterias();
  const { materiasVisibles, carreraActiva } = useCarreraActivaContext();

  const [busqueda, setBusqueda] = useState("");
  // Se puede llegar con el filtro ya puesto (ej. desde Gráficos: /materias?estado=pendiente).
  const pedido = useSearchParams().get("estado");
  const [filtro, setFiltro] = useState<Filtro>(
    pedido && pedido in ESTADOS ? (pedido as EstadoMateria) : "todas"
  );

  const conteo = useMemo(() => {
    const c: Partial<Record<EstadoMateria, number>> = {};
    materiasVisibles.forEach((m) => { c[m.estado] = (c[m.estado] ?? 0) + 1; });
    return c;
  }, [materiasVisibles]);

  const grupos = useMemo(() => {
    // Sin acentos ni mayúsculas: "analisis" encuentra "Análisis".
    const q = normalizarTexto(busqueda);
    const filtradas = materiasVisibles.filter(
      (m) =>
        (filtro === "todas" || m.estado === filtro) &&
        (q === "" ||
          normalizarTexto(m.nombre).includes(q) ||
          normalizarTexto(m.codigo_interno ?? "").includes(q))
    );
    return ESTADOS_ORDEN
      .map((estado) => ({ estado, materias: filtradas.filter((m) => m.estado === estado) }))
      .filter((g) => g.materias.length > 0);
  }, [materiasVisibles, busqueda, filtro]);

  const totalMostradas = grupos.reduce((acc, g) => acc + g.materias.length, 0);
  const hayFiltros = busqueda !== "" || filtro !== "todas";

  return (
    <main className="page page-narrow">
      <PageHeader
        titulo="Materias"
        subtitulo={
          loading
            ? undefined
            : `${materiasVisibles.length} ${materiasVisibles.length === 1 ? "materia" : "materias"}${
                carreraActiva ? ` en ${carreraActiva.nombre}` : ""
              }`
        }
        acciones={
          <>
            <Link href="/materias/importar" className="btn btn-secondary" title="Traer materias y notas de SIU Guaraní">
              <RefreshCw size={15} /> <span className="hidden sm:inline">Traer de SIU</span>
            </Link>
            <Link href="/materias/nueva" className="btn btn-primary">
              <Plus size={16} /> Nueva
            </Link>
          </>
        }
      />

      {loading ? (
        <Esqueleto filas={5} alto="h-14" />
      ) : materiasVisibles.length === 0 ? (
        <EmptyState
          icono={<BookOpen size={22} />}
          titulo={carreraActiva ? `Todavía no hay materias en ${carreraActiva.nombre}` : "Todavía no cargaste materias"}
          texto="Podés traerlas todas juntas desde SIU Guaraní o cargarlas una por una."
        >
          <Link href="/materias/importar" className="btn btn-primary">
            <RefreshCw size={15} /> Traer de SIU Guaraní
          </Link>
          <Link href="/materias/nueva" className="btn btn-secondary">
            <Plus size={16} /> Cargar a mano
          </Link>
        </EmptyState>
      ) : (
        <>
          <div className="relative mb-3">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-subtle pointer-events-none" />
            <input
              id="buscar-materia"
              type="search"
              className="input !pl-10 !pr-10"
              placeholder="Buscar por nombre o código"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar materia"
            />
            {busqueda && (
              <button
                type="button"
                className="icon-btn icon-btn-sm absolute right-1.5 top-1/2 -translate-y-1/2"
                onClick={() => setBusqueda("")}
                aria-label="Borrar búsqueda"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1 mb-5" role="group" aria-label="Filtrar por estado">
            <button type="button" className="chip" aria-pressed={filtro === "todas"} onClick={() => setFiltro("todas")}>
              Todas <span className="opacity-70 tabular">{materiasVisibles.length}</span>
            </button>
            {ESTADOS_ORDEN.filter((e) => conteo[e]).map((e) => (
              <button key={e} type="button" className="chip" aria-pressed={filtro === e} onClick={() => setFiltro(e)}>
                {ESTADOS[e].plural} <span className="opacity-70 tabular">{conteo[e]}</span>
              </button>
            ))}
          </div>

          {totalMostradas === 0 ? (
            <EmptyState
              icono={<Search size={22} />}
              titulo="Ninguna materia coincide"
              texto={busqueda ? `No encontramos nada con "${busqueda}".` : undefined}
            >
              {hayFiltros && (
                <button type="button" className="btn btn-secondary" onClick={() => { setBusqueda(""); setFiltro("todas"); }}>
                  Ver todas
                </button>
              )}
            </EmptyState>
          ) : (
            <div className="space-y-5">
              {grupos.map(({ estado, materias }) => (
                <section key={estado}>
                  <h2 className="eyebrow mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: ESTADOS[estado].color }} />
                    {ESTADOS[estado].plural} · {materias.length}
                  </h2>
                  <div className="card overflow-hidden divide-y divide-card-border">
                    {materias.map((m) => <MateriaFila key={m.id} materia={m} sinEstado />)}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
