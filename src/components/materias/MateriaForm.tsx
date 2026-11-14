"use client";

// src/components/materias/MateriaForm.tsx
// Formulario de materia: el mismo para crearla y para editarla. Antes una
// materia no se podía corregir después de creada (un nombre mal escrito
// obligaba a borrarla y perder sus notas).
//
// Lo imprescindible (nombre, estado, carrera) va arriba; lo demás queda
// plegado en "Más detalles" para que cargar una materia sea cosa de segundos.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteField } from "firebase/firestore";
import { ChevronDown, Search, Users } from "lucide-react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useMaterias } from "@/hooks/useMaterias";
import { useCarreraActivaContext } from "@/components/dashboard/CarreraActivaProvider";
import { useToast } from "@/components/ui/Feedback";
import { Campo, Spinner } from "@/components/ui/kit";
import { addMateria, updateMateria } from "@/lib/firestore";
import { gruposPorDefecto } from "@/lib/calculo-notas";
import { buscarEnCatalogo, vincularConCatalogo } from "@/lib/catalogoCliente";
import { normalizarTexto } from "@/lib/catalogo";
import { ESTADOS, ESTADOS_ORDEN } from "@/lib/estados";
import { EstadoMateria, Materia, MateriaCatalogo } from "@/types";

export function MateriaForm({ materia }: { materia?: Materia }) {
  const { user } = useAuthContext();
  const router = useRouter();
  const toast = useToast();
  const { materias } = useMaterias();
  const { carreras, carreraActivaId } = useCarreraActivaContext();
  const editando = !!materia;
  const volverA = materia ? `/materias/${materia.id}` : "/materias";

  const [nombre, setNombre] = useState(materia?.nombre ?? "");
  const [estado, setEstado] = useState<EstadoMateria>(materia?.estado ?? "cursando");
  // null = el usuario todavía no tocó las carreras: se usa la sugerida. Se
  // calcula en cada render y no al montar porque las carreras pueden llegar un
  // instante después (al entrar directo a esta pantalla).
  const [carrerasElegidas, setCarrerasElegidas] = useState<string[] | null>(
    materia?.carreras_vinculadas ?? null
  );
  // Al crear, arranca vinculada a la carrera que se está mirando (o a la única que hay).
  const sugeridas = carreraActivaId ? [carreraActivaId] : carreras.length === 1 ? [carreras[0].id] : [];
  const carrerasSel = carrerasElegidas ?? sugeridas;
  const [codigo, setCodigo] = useState(materia?.codigo_interno ?? "");
  const [periodo, setPeriodo] = useState(materia?.periodo_cursado ?? "");
  const [añoPlan, setAñoPlan] = useState(materia?.año_plan ? String(materia.año_plan) : "");
  const [cuatrimestre, setCuatrimestre] = useState(
    materia?.cuatrimestre_plan !== undefined && materia?.cuatrimestre_plan !== null
      ? String(materia.cuatrimestre_plan)
      : ""
  );
  const [notaAprobar, setNotaAprobar] = useState(String(materia?.configuracion_nota.nota_aprobar ?? 4));
  const [notaPromocionar, setNotaPromocionar] = useState(String(materia?.configuracion_nota.nota_promocionar ?? 7));
  const [correlativas, setCorrelativas] = useState<string[]>(materia?.correlativas_requisito ?? []);
  const [buscarCorrelativa, setBuscarCorrelativa] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coincidencias, setCoincidencias] = useState<{ para: string; lista: MateriaCatalogo[] }>({
    para: "",
    lista: [],
  });

  // La institución sale de la primera carrera elegida: define en qué catálogo
  // buscar (las materias de una facultad no se mezclan con las de otra).
  const carreraPrincipal = carreras.find((c) => c.id === carrerasSel[0]) ?? null;
  const institucion = carreraPrincipal?.institucion ?? "";

  // Mientras se escribe el nombre, busca en el catálogo compartido para avisar
  // si la materia ya existe en vez de crear un duplicado. Solo al crear.
  const consulta = !editando && institucion && nombre.trim().length >= 3
    ? `${normalizarTexto(institucion)}|${nombre.trim()}`
    : "";
  useEffect(() => {
    if (!consulta) return;
    const [institucionId, texto] = consulta.split("|");
    const timer = setTimeout(() => {
      buscarEnCatalogo(institucionId, texto).then((lista) => setCoincidencias({ para: consulta, lista }));
    }, 350);
    return () => clearTimeout(timer);
  }, [consulta]);
  const sugerencias = coincidencias.para === consulta
    ? coincidencias.lista.filter((c) => c.nombre_canonico !== nombre.trim())
    : [];

  const alternar = (lista: string[], id: string) =>
    lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id];

  const q = normalizarTexto(buscarCorrelativa);
  const candidatas = materias.filter((m) => m.id !== materia?.id);
  const candidatasVisibles = candidatas.filter(
    (m) => correlativas.includes(m.id) || q === "" || normalizarTexto(m.nombre).includes(q)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) { setError("Escribí el nombre de la materia."); return; }

    const aprobar = Number(notaAprobar.replace(",", "."));
    const promocionar = Number(notaPromocionar.replace(",", "."));
    if (!(aprobar >= 1 && aprobar <= 10) || !(promocionar >= 1 && promocionar <= 10)) {
      setError("Las notas para aprobar y promocionar tienen que estar entre 1 y 10.");
      return;
    }
    if (promocionar < aprobar) {
      setError("La nota para promocionar no puede ser menor que la de aprobar.");
      return;
    }

    setError(null);
    setGuardando(true);
    const año = añoPlan ? Number(añoPlan) : undefined;
    const cuat = cuatrimestre !== "" ? Number(cuatrimestre) : undefined;

    try {
      if (materia) {
        // Al editar, un campo que se vació hay que borrarlo explícitamente:
        // mandar undefined lo dejaría con el valor viejo.
        const borrar = deleteField() as unknown as undefined;
        await updateMateria(user.uid, materia.id, {
          nombre: nombreLimpio,
          estado,
          carreras_vinculadas: carrerasSel,
          correlativas_requisito: correlativas,
          codigo_interno: codigo.trim() || borrar,
          periodo_cursado: periodo.trim() || borrar,
          año_plan: año ?? (borrar as unknown as number),
          cuatrimestre_plan: cuat ?? (borrar as unknown as number),
          configuracion_nota: {
            ...materia.configuracion_nota,
            nota_aprobar: aprobar,
            nota_promocionar: promocionar,
          },
        });
        toast("Cambios guardados");
        router.push(volverA);
        return;
      }

      const nuevoId = await addMateria(user.uid, {
        nombre: nombreLimpio,
        codigo_interno: codigo.trim() || undefined,
        estado,
        periodo_cursado: periodo.trim() || undefined,
        año_plan: año,
        cuatrimestre_plan: cuat,
        carreras_vinculadas: carrerasSel,
        correlativas_requisito: correlativas,
        configuracion_nota: {
          sistema: "grupos_ponderados",
          grupos: gruposPorDefecto(),
          nota_aprobar: aprobar,
          nota_promocionar: promocionar,
        },
        evaluaciones: [],
        ultima_actualizacion: new Date().toISOString(),
      });

      // Vincular con el catálogo compartido para que quede unida a la misma
      // materia que cargaron otros estudiantes de la facultad. Sin await: si
      // falla o tarda, la materia igual quedó guardada.
      if (carreraPrincipal?.institucion) {
        vincularConCatalogo(user, carreraPrincipal.institucion, [
          { materia_id: nuevoId, nombre: nombreLimpio, codigo: codigo.trim() || null, carrera: carreraPrincipal.nombre },
        ]);
      }

      toast(`${nombreLimpio} agregada`);
      router.push(`/materias/${nuevoId}`);
    } catch {
      setError("No se pudo guardar la materia. Revisá tu conexión e intentá de nuevo.");
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <div className="notice notice-error" role="alert">{error}</div>}

      <div className="card card-pad space-y-5">
        <Campo label="Nombre de la materia" htmlFor="mat-nombre">
          <input
            id="mat-nombre"
            className="input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Álgebra Lineal"
            maxLength={200}
            autoFocus={!editando}
            autoComplete="off"
          />
          {sugerencias.length > 0 && (
            <div className="mt-2 rounded-[var(--radius-md)] bg-background-alt p-3">
              <p className="text-xs font-bold text-foreground-muted flex items-center gap-1.5 mb-2">
                <Users size={13} /> Otros estudiantes de {institucion} ya la cargaron. ¿Es alguna de estas?
              </p>
              <div className="space-y-1.5">
                {sugerencias.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setNombre(c.nombre_canonico); if (c.codigo) setCodigo(c.codigo); }}
                    className="card card-interactive w-full text-left px-3 py-2 !shadow-none"
                  >
                    <span className="text-sm font-bold text-foreground">{c.nombre_canonico}</span>
                    {c.codigo && <span className="text-xs text-foreground-subtle ml-1.5">{c.codigo}</span>}
                    <span className="block text-xs text-foreground-subtle">
                      {c.cantidad_usuarios} {c.cantidad_usuarios === 1 ? "persona la tiene" : "personas la tienen"}
                    </span>
                  </button>
                ))}
              </div>
              <p className="hint">Usar el mismo nombre te conecta con los comentarios de esa materia.</p>
            </div>
          )}
        </Campo>

        <div>
          <span className="label" id="mat-estado-label">¿En qué estado está?</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="mat-estado-label">
            {ESTADOS_ORDEN.map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={estado === e}
                onClick={() => setEstado(e)}
                className="chip"
              >
                {ESTADOS[e].label}
              </button>
            ))}
          </div>
          <p className="hint">{ESTADOS[estado].ayuda}.</p>
        </div>

        {carreras.length > 0 ? (
          <div>
            <span className="label" id="mat-carreras-label">
              {carreras.length === 1 ? "¿Es de esta carrera?" : "¿De qué carrera es?"}
            </span>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="mat-carreras-label">
              {carreras.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={carrerasSel.includes(c.id)}
                  onClick={() => setCarrerasElegidas(alternar(carrerasSel, c.id))}
                  className="chip"
                >
                  {c.nombre}
                </button>
              ))}
            </div>
            {carreras.length > 1 && (
              <p className="hint">Si la materia cuenta para más de una carrera, marcá todas.</p>
            )}
          </div>
        ) : (
          <p className="notice">
            <span>
              Todavía no creaste ninguna carrera. No es obligatorio, pero con una carrera podés ver tu
              avance. <Link href="/carreras" className="link">Crear carrera</Link>
            </span>
          </p>
        )}
      </div>

      <details className="card group" open={editando}>
        <summary className="card-pad flex items-center justify-between gap-3 list-none [&::-webkit-details-marker]:hidden">
          <span>
            <span className="section-title block">Más detalles</span>
            <span className="text-sm text-foreground-muted">
              Código, año del plan, notas para aprobar y correlativas. Todo opcional.
            </span>
          </span>
          <ChevronDown size={18} className="text-foreground-subtle flex-shrink-0 transition-transform group-open:rotate-180" />
        </summary>

        <div className="card-pad !pt-0 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Campo label="Código" htmlFor="mat-codigo">
              <input id="mat-codigo" className="input" value={codigo} onChange={(e) => setCodigo(e.target.value)}
                placeholder="MAT-101" maxLength={50} />
            </Campo>
            <Campo label="Año del plan" htmlFor="mat-anio">
              <select id="mat-anio" className="input" value={añoPlan} onChange={(e) => setAñoPlan(e.target.value)}>
                <option value="">—</option>
                {[1, 2, 3, 4, 5, 6, 7].map((a) => <option key={a} value={a}>{a}° año</option>)}
              </select>
            </Campo>
            <Campo label="Cuatrimestre" htmlFor="mat-cuat">
              <select id="mat-cuat" className="input" value={cuatrimestre} onChange={(e) => setCuatrimestre(e.target.value)}>
                <option value="">—</option>
                <option value="1">1°</option>
                <option value="2">2°</option>
                <option value="0">Anual</option>
              </select>
            </Campo>
            <Campo label="La cursé en" htmlFor="mat-periodo">
              <input id="mat-periodo" className="input" value={periodo} onChange={(e) => setPeriodo(e.target.value)}
                placeholder={`${new Date().getFullYear()}-1C`} maxLength={50} />
            </Campo>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Nota para aprobar" htmlFor="mat-aprobar">
              <input id="mat-aprobar" className="input tabular" inputMode="decimal" value={notaAprobar}
                onChange={(e) => setNotaAprobar(e.target.value)} />
            </Campo>
            <Campo label="Nota para promocionar" htmlFor="mat-promocionar">
              <input id="mat-promocionar" className="input tabular" inputMode="decimal" value={notaPromocionar}
                onChange={(e) => setNotaPromocionar(e.target.value)} />
            </Campo>
          </div>

          {candidatas.length > 0 && (
            <div>
              <span className="label" id="mat-correlativas-label">
                Correlativas
                {correlativas.length > 0 && <span className="font-medium text-foreground-subtle"> · {correlativas.length} elegidas</span>}
              </span>
              <p className="hint !mt-0 mb-2">Las materias que necesitás tener aprobadas o regulares para cursar esta.</p>
              {candidatas.length > 8 && (
                <div className="relative mb-2">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle pointer-events-none" />
                  <input
                    type="search"
                    className="input input-sm !pl-9"
                    placeholder="Buscar materia"
                    value={buscarCorrelativa}
                    onChange={(e) => setBuscarCorrelativa(e.target.value)}
                    aria-label="Buscar correlativa"
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto" role="group" aria-labelledby="mat-correlativas-label">
                {candidatasVisibles.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={correlativas.includes(m.id)}
                    onClick={() => setCorrelativas((prev) => alternar(prev, m.id))}
                    className="chip"
                  >
                    {m.nombre}
                  </button>
                ))}
                {candidatasVisibles.length === 0 && (
                  <p className="text-sm text-foreground-subtle">Ninguna materia coincide.</p>
                )}
              </div>
            </div>
          )}

          {!editando && (
            <p className="hint">
              La nota final arranca calculándose como parciales 50% + trabajos prácticos 20% + final 30%.
              Lo cambiás cuando quieras desde la materia.
            </p>
          )}
        </div>
      </details>

      <div className="flex gap-3 pt-2">
        <Link href={volverA} className="btn btn-secondary btn-lg flex-1">Cancelar</Link>
        <button id="btn-guardar-materia" type="submit" className="btn btn-primary btn-lg flex-1" disabled={guardando}>
          {guardando && <Spinner />}
          {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Agregar materia"}
        </button>
      </div>
    </form>
  );
}
