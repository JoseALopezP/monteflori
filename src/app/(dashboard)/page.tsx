"use client";

// src/app/(dashboard)/page.tsx
// Inicio. Responde tres preguntas, en este orden:
//   1. ¿Cómo voy? (avance de la carrera)
//   2. ¿Qué se viene? (próximas fechas)
//   3. ¿Qué estoy cursando? (con las notas a mano para cargarlas ahí mismo)
//
// Si todavía no hay materias, en vez de un tablero vacío se muestra cómo
// empezar.

import { useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, PenLine, Puzzle, Route } from "lucide-react";

import { useAuthContext } from "@/components/auth/AuthProvider";
import { useMaterias } from "@/hooks/useMaterias";
import { usePerfil } from "@/hooks/usePerfil";
import { useCarreraActivaContext } from "@/components/dashboard/CarreraActivaProvider";
import { ProximasFechas } from "@/components/dashboard/ProximasFechas";
import { MateriaCursandoCard } from "@/components/materias/MateriaCursandoCard";
import { FechaModal } from "@/components/notas/FechaModal";
import { EmptyState, Esqueleto } from "@/components/ui/kit";
import { calcularPromedioGeneral, calcularPorcentajeAvance } from "@/lib/calculo-notas";
import { buildGrafo, getMateriasHabilitadas } from "@/lib/grafo-correlativas";
import { generarMensajeMotivacional } from "@/lib/motivacion";
import { formatearNota } from "@/lib/estados";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function HomePage() {
  const { user } = useAuthContext();
  const { materias, loading: matLoading } = useMaterias();
  const { perfil } = usePerfil();
  const { carreraActiva, carreras, materiasVisibles, loading: carLoading } = useCarreraActivaContext();
  const [agendando, setAgendando] = useState(false);

  const nombre = perfil?.perfil.alias || (perfil?.perfil.nombre || user?.displayName || "").split(" ")[0];
  const hoy = format(new Date(), "EEEE d 'de' MMMM", { locale: es });

  const saludo = (
    <header className="mb-6">
      <p className="eyebrow mb-1">{hoy}</p>
      <h1 className="page-title">{nombre ? `Hola, ${nombre}` : "Hola"}</h1>
    </header>
  );

  if (matLoading || carLoading) {
    return (
      <main className="page">
        {saludo}
        <Esqueleto filas={3} alto="h-32" />
      </main>
    );
  }

  // ── Primera vez: nada cargado todavía ──
  if (materias.length === 0) {
    return (
      <main className="page page-narrow">
        {saludo}
        <Bienvenida />
      </main>
    );
  }

  const cursando = materiasVisibles.filter((m) => m.estado === "cursando");
  const aprobadas = materiasVisibles.filter((m) => m.estado === "aprobada").length;
  const total = carreraActiva?.total_materias_plan ?? materiasVisibles.length;
  const porcentaje = Math.min(100, calcularPorcentajeAvance(materiasVisibles, carreraActiva?.total_materias_plan));
  const promedio = calcularPromedioGeneral(materiasVisibles);
  const habilitadas = getMateriasHabilitadas(buildGrafo(materiasVisibles)).length;
  const mensaje = generarMensajeMotivacional(materiasVisibles, carreraActiva?.total_materias_plan);

  return (
    <main className="page space-y-6">
      {saludo}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 !mt-0">
        {/* ── Cómo voy ── */}
        <section className="card card-pad lg:col-span-3 flex flex-col">
          <div className="flex items-center gap-5">
            <Anillo porcentaje={porcentaje} />
            <div className="min-w-0">
              <p className="eyebrow">
                {carreraActiva ? carreraActiva.nombre : carreras.length > 1 ? "Todas tus carreras" : "Tu carrera"}
              </p>
              <p className="font-display text-2xl sm:text-3xl font-semibold text-foreground leading-tight mt-1">
                {aprobadas} de {total} materias
              </p>
              <p className="text-sm text-foreground-muted mt-0.5">
                aprobadas{total - aprobadas > 0 ? ` · te faltan ${total - aprobadas}` : " · ¡carrera completa!"}
              </p>
            </div>
          </div>

          <p className="text-sm text-foreground-muted mt-5 leading-relaxed">{mensaje.texto}</p>

          <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-card-border">
            <Dato valor={promedio > 0 ? formatearNota(promedio) : "—"} etiqueta="Promedio" />
            <Dato valor={cursando.length} etiqueta="Cursando" />
            <Dato valor={habilitadas} etiqueta="Podés cursar" href="/materias/pasos" />
          </div>
        </section>

        {/* ── Qué se viene ── */}
        <div className="lg:col-span-2 flex flex-col [&>*]:flex-1">
          <ProximasFechas materias={materiasVisibles} onAgendar={() => setAgendando(true)} />
        </div>
      </div>

      {/* ── Qué estoy cursando ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title flex items-center gap-2">
            Cursando ahora
            {cursando.length > 0 && <span className="badge">{cursando.length}</span>}
          </h2>
          <Link href="/materias" className="link text-sm inline-flex items-center gap-0.5">
            Todas las materias <ChevronRight size={14} />
          </Link>
        </div>

        {cursando.length === 0 ? (
          <EmptyState
            icono={<BookOpen size={22} />}
            titulo="No estás cursando ninguna materia"
            texto={
              habilitadas > 0
                ? `Tenés ${habilitadas} ${habilitadas === 1 ? "materia que ya podés" : "materias que ya podés"} cursar. Entrá a una y pasala a "Cursando" para seguirla desde acá.`
                : 'Marcá como "Cursando" las materias de este cuatrimestre para seguirlas desde acá.'
            }
          >
            <Link href="/materias/pasos" className="btn btn-primary">
              <Route size={16} /> Ver qué puedo cursar
            </Link>
            <Link href="/materias/nueva" className="btn btn-secondary">Nueva materia</Link>
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {cursando.map((m) => <MateriaCursandoCard key={m.id} materia={m} />)}
          </div>
        )}
      </section>

      {agendando && <FechaModal materias={materiasVisibles} onCerrar={() => setAgendando(false)} />}
    </main>
  );
}

// ── Piezas ──────────────────────────────────────────────────

function Anillo({ porcentaje }: { porcentaje: number }) {
  const radio = 42;
  const largo = 2 * Math.PI * radio;
  return (
    <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0" role="img" aria-label={`${porcentaje}% de la carrera`}>
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={radio} fill="none" stroke="var(--background-alt)" strokeWidth="9" />
        <circle
          cx="50" cy="50" r={radio} fill="none"
          stroke="var(--color-primary)" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={largo}
          strokeDashoffset={largo * (1 - porcentaje / 100)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display tabular text-2xl sm:text-[1.7rem] font-semibold text-foreground">
        {porcentaje}
        <span className="text-sm font-sans font-bold text-foreground-muted ml-0.5">%</span>
      </span>
    </div>
  );
}

function Dato({ valor, etiqueta, href }: { valor: string | number; etiqueta: string; href?: string }) {
  const contenido = (
    <>
      <span className="block font-display tabular text-2xl font-semibold text-foreground leading-none">{valor}</span>
      <span className="text-xs font-semibold text-foreground-muted mt-1.5 inline-flex items-center gap-0.5">
        {etiqueta}
        {href && <ChevronRight size={12} />}
      </span>
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-[var(--radius-sm)] -m-1.5 p-1.5 row-hover">{contenido}</Link>
  ) : (
    <div>{contenido}</div>
  );
}

function Bienvenida() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="card card-pad">
        <h2 className="font-display text-2xl font-semibold text-foreground">Empecemos por tus materias</h2>
        <p className="text-sm text-foreground-muted mt-2 leading-relaxed">
          Con tus materias cargadas, Monteflori te muestra cuánto te falta para recibirte, qué podés
          cursar ahora y cómo venís en cada una. Elegí cómo traerlas:
        </p>
      </div>

      <Link href="/materias/importar" className="card card-pad card-interactive flex items-start gap-4">
        <span className="w-11 h-11 rounded-full bg-primary text-primary-fg flex items-center justify-center flex-shrink-0">
          <Puzzle size={20} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-foreground">Traerlas de SIU Guaraní</span>
            <span className="badge" style={{ background: "var(--color-primary-soft)", color: "var(--color-primary)" }}>
              Recomendado
            </span>
          </span>
          <span className="block text-sm text-foreground-muted mt-1">
            Una extensión del navegador lee tu plan de estudios, tus notas y las correlativas desde el
            portal de tu facultad. Lleva un par de minutos y trae todo de una.
          </span>
        </span>
        <ChevronRight size={18} className="text-foreground-subtle flex-shrink-0 mt-3" />
      </Link>

      <Link href="/materias/nueva" className="card card-pad card-interactive flex items-start gap-4">
        <span className="w-11 h-11 rounded-full bg-background-alt text-foreground-muted flex items-center justify-center flex-shrink-0">
          <PenLine size={20} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="font-bold text-foreground">Cargarlas a mano</span>
          <span className="block text-sm text-foreground-muted mt-1">
            Si tu facultad no usa SIU Guaraní o preferís empezar solo con lo que estás cursando.
          </span>
        </span>
        <ChevronRight size={18} className="text-foreground-subtle flex-shrink-0 mt-3" />
      </Link>
    </div>
  );
}
