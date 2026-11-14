"use client";

// src/app/(dashboard)/materias/importar/page.tsx
// Trae materias y notas desde SIU Guaraní usando la extensión Monteflori Sync.
// La pantalla guía según dónde esté parado el usuario:
//   - no tiene la extensión      → cómo instalarla
//   - la tiene pero no sincronizó → qué hacer en el portal de la facultad
//   - hay datos                   → revisar y confirmar antes de guardar
// El scraper recorre todas las carreras, así que se revisa una sección por carrera.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Puzzle, RefreshCw } from "lucide-react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useCarreraActivaContext } from "@/components/dashboard/CarreraActivaProvider";
import { PageHeader, Spinner } from "@/components/ui/kit";
import { addCarrera, getMaterias, importarMateriasScrapeadas } from "@/lib/firestore";
import { sincronizarCalendar } from "@/lib/calendarCliente";
import { vincularConCatalogo, MateriaAVincular } from "@/lib/catalogoCliente";
import {
  extensionConfigurada, pingExtension, obtenerUltimaSincronizacion,
  limpiarUltimaSincronizacion, ScrapeData, MateriaScrapeada,
} from "@/lib/extensionSync";
import { ESTADOS, ESTADOS_ORDEN, parsearNota } from "@/lib/estados";
import { normalizarTexto } from "@/lib/catalogo";
import { Carrera, EstadoMateria } from "@/types";

type Estado = "verificando" | "sin-extension" | "sin-datos" | "listo" | "importando" | "hecho";

const NUEVA_CARRERA = "__nueva__";
const SIN_CARRERA = "__sin_carrera__";

interface FilaEditable extends MateriaScrapeada {
  incluir: boolean;
}

interface SeccionEditable {
  nombreOriginal: string | null;
  carreraId: string;
  nombreNuevaCarrera: string;
  filas: FilaEditable[];
}

function armarSecciones(data: ScrapeData, carreras: Carrera[]): SeccionEditable[] {
  return data.carreras
    .filter((c) => c.materias.length > 0)
    .map((c) => {
      // Si ya existe una carrera con ese nombre, se propone vincular a esa.
      const existente = c.carrera
        ? carreras.find((x) => normalizarTexto(x.nombre) === normalizarTexto(c.carrera!))
        : null;
      return {
        nombreOriginal: c.carrera,
        carreraId: existente ? existente.id : c.carrera ? NUEVA_CARRERA : SIN_CARRERA,
        nombreNuevaCarrera: c.carrera ?? "",
        filas: c.materias.map((m) => ({ ...m, incluir: true })),
      };
    });
}

export default function ImportarPage() {
  const { user } = useAuthContext();
  const { carreras, carreraActivaId, setCarreraActivaId } = useCarreraActivaContext();

  const [estado, setEstado] = useState<Estado>(() => (extensionConfigurada() ? "verificando" : "sin-extension"));
  const [scrapeData, setScrapeData] = useState<ScrapeData | null>(null);
  const [secciones, setSecciones] = useState<SeccionEditable[]>([]);
  const [resultado, setResultado] = useState<{ creadas: number; actualizadas: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  const buscar = useCallback(async () => {
    if (!extensionConfigurada() || !(await pingExtension())) {
      setEstado("sin-extension");
      return;
    }
    const data = await obtenerUltimaSincronizacion();
    const total = data?.carreras?.reduce((acc, c) => acc + c.materias.length, 0) ?? 0;
    if (!data || total === 0) {
      setEstado("sin-datos");
      return;
    }
    setScrapeData(data);
    setSecciones(armarSecciones(data, carreras));
    setEstado("listo");
    // `carreras` se lee una sola vez, al encontrar los datos: después el
    // usuario puede estar editando las secciones y no queremos pisárselas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consulta a la extensión: los setState ocurren después del await
    buscar();
  }, [buscar]);

  async function reintentar() {
    setBuscando(true);
    await buscar();
    setBuscando(false);
  }

  function actualizarSeccion(i: number, cambios: Partial<SeccionEditable>) {
    setSecciones((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...cambios } : s)));
  }

  function actualizarFila(iSeccion: number, iFila: number, cambios: Partial<FilaEditable>) {
    setSecciones((prev) =>
      prev.map((s, idx) =>
        idx !== iSeccion
          ? s
          : { ...s, filas: s.filas.map((f, j) => (j === iFila ? { ...f, ...cambios } : f)) }
      )
    );
  }

  async function handleImportar() {
    if (!user) return;
    const sinNombre = secciones.some(
      (s) => s.carreraId === NUEVA_CARRERA && !s.nombreNuevaCarrera.trim() && s.filas.some((f) => f.incluir)
    );
    if (sinNombre) {
      setError("Ponele un nombre a la carrera nueva, o elegí otra opción en “Guardar en”.");
      return;
    }

    setError(null);
    setEstado("importando");
    try {
      let creadasTotal = 0;
      let actualizadasTotal = 0;
      let primeraCarreraNueva: string | null = null;
      const paraCatalogo: MateriaAVincular[] = [];

      for (const seccion of secciones) {
        const seleccionadas = seccion.filas.filter((f) => f.incluir);
        if (seleccionadas.length === 0) continue;

        let idCarrera: string | null = null;
        if (seccion.carreraId === NUEVA_CARRERA) {
          idCarrera = await addCarrera(user.uid, {
            nombre: seccion.nombreNuevaCarrera.trim(),
            institucion: scrapeData?.universidad ?? "",
          });
          primeraCarreraNueva ??= idCarrera;
        } else if (seccion.carreraId !== SIN_CARRERA) {
          idCarrera = seccion.carreraId;
        }

        // Se releen las materias en cada sección: una sección puede crear
        // materias que la siguiente necesita ver para no duplicarlas (ej. una
        // materia compartida entre dos carreras).
        const existentes = await getMaterias(user.uid);
        const res = await importarMateriasScrapeadas(user.uid, idCarrera, seleccionadas, existentes);
        creadasTotal += res.creadas;
        actualizadasTotal += res.actualizadas;

        res.importadas.forEach((m) =>
          paraCatalogo.push({ materia_id: m.id, nombre: m.nombre, codigo: m.codigo, carrera: seccion.nombreOriginal })
        );
      }

      await limpiarUltimaSincronizacion();

      // Si era la primera carrera del usuario, pasa a ser la que se mira.
      if (primeraCarreraNueva && carreras.length === 0 && !carreraActivaId) {
        setCarreraActivaId(primeraCarreraNueva);
      }

      // Vincular con el catálogo compartido. El código que trae SIU es la mejor
      // clave de deduplicación que tenemos: dos personas de la misma facultad
      // caen en la misma entrada sin que haya que preguntar nada.
      if (scrapeData?.universidad) {
        vincularConCatalogo(user, scrapeData.universidad, paraCatalogo);
      }
      // La importación puede traer fechas nuevas: que lleguen al calendario
      // sin esperar al repaso del día siguiente.
      sincronizarCalendar(user);

      setResultado({ creadas: creadasTotal, actualizadas: actualizadasTotal });
      setEstado("hecho");
    } catch {
      setError("Algo falló mientras se guardaba. Lo que ya se importó quedó guardado; podés volver a intentar sin que se duplique.");
      setEstado("listo");
    }
  }

  const totalFilas = secciones.reduce((acc, s) => acc + s.filas.length, 0);
  const totalIncluidas = secciones.reduce((acc, s) => acc + s.filas.filter((f) => f.incluir).length, 0);

  return (
    <main className="page page-narrow">
      <PageHeader
        titulo="Traer de SIU Guaraní"
        subtitulo="Tus materias, notas y correlativas, directo desde el portal de tu facultad."
        volver={{ href: "/materias", label: "Materias" }}
      />

      {estado === "verificando" && (
        <div className="card card-pad flex flex-col items-center gap-3 py-12 text-foreground-muted">
          <Spinner size={26} className="text-primary" />
          <p className="text-sm">Buscando la extensión...</p>
        </div>
      )}

      {estado === "sin-extension" && (
        <div className="card card-pad">
          <Pasos actual={1} />
          <div className="flex flex-col items-center text-center pt-2">
            <span className="w-14 h-14 rounded-full bg-background-alt flex items-center justify-center text-foreground-muted mb-3">
              <Puzzle size={26} />
            </span>
            <h2 className="font-display text-xl font-semibold text-foreground">Primero instalá la extensión</h2>
            <p className="text-sm text-foreground-muted mt-1.5 max-w-md">
              Monteflori Sync es una extensión de Chrome que lee tus materias desde SIU Guaraní. Se instala
              una sola vez y no te pide tu contraseña de la facultad.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              <Link href="/extension" className="btn btn-primary">Cómo instalarla</Link>
              <button type="button" className="btn btn-secondary" onClick={reintentar} disabled={buscando}>
                {buscando ? <Spinner size={14} /> : <RefreshCw size={14} />} Ya la instalé
              </button>
            </div>
            <p className="hint max-w-sm">
              Funciona en Chrome, Edge y Brave para computadora. Si estás en el celular, podés{" "}
              <Link href="/materias/nueva" className="link">cargar tus materias a mano</Link>.
            </p>
          </div>
        </div>
      )}

      {estado === "sin-datos" && (
        <div className="card card-pad">
          <Pasos actual={2} />
          <h2 className="font-display text-xl font-semibold text-foreground">Ahora sincronizá desde el portal</h2>
          <ol className="mt-4 space-y-3">
            {[
              "Abrí el SIU Guaraní de tu facultad en otra pestaña e iniciá sesión como siempre.",
              "Tocá el ícono de Monteflori Sync (arriba a la derecha del navegador) y elegí “Sincronizar ahora”.",
              "Esperá a que termine: recorre todas tus carreras y puede tardar uno o dos minutos.",
              "Volvé a esta pestaña y tocá el botón de acá abajo.",
            ].map((paso, i) => (
              <li key={i} className="flex gap-3 text-sm text-foreground-muted">
                <span className="w-6 h-6 rounded-full bg-background-alt text-foreground font-bold text-xs flex items-center justify-center flex-shrink-0 tabular">
                  {i + 1}
                </span>
                <span className="pt-0.5">{paso}</span>
              </li>
            ))}
          </ol>
          <button type="button" className="btn btn-primary mt-5" onClick={reintentar} disabled={buscando}>
            {buscando ? <Spinner size={14} /> : <RefreshCw size={14} />} Ya sincronicé, traer mis materias
          </button>
        </div>
      )}

      {(estado === "listo" || estado === "importando") && scrapeData && (
        <div className="space-y-4">
          <div className="card card-pad !pb-4">
            <Pasos actual={3} />
            <h2 className="font-display text-xl font-semibold text-foreground">Revisá antes de guardar</h2>
            <p className="text-sm text-foreground-muted mt-1">
              Encontramos <strong className="text-foreground">{totalFilas} materias</strong> en{" "}
              {secciones.length === 1 ? "una carrera" : `${secciones.length} carreras`} ({scrapeData.universidad}).
              Destildá las que no quieras traer y corregí lo que haga falta. Las que ya tenías se actualizan, no se duplican.
            </p>
          </div>

          {scrapeData.errores && scrapeData.errores.length > 0 && (
            <div className="notice notice-warn">
              <AlertTriangle size={17} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {scrapeData.errores.length === 1 ? "Hubo un dato" : `Hubo ${scrapeData.errores.length} datos`} que no se pudieron leer
                </p>
                <p className="text-xs mt-0.5">El resto se trae igual. Después podés completar a mano lo que falte.</p>
                <ul className="list-disc list-inside text-xs mt-1.5 space-y-0.5 opacity-90">
                  {scrapeData.errores.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            </div>
          )}

          {error && <div className="notice notice-error" role="alert">{error}</div>}

          {secciones.map((seccion, iSeccion) => {
            const incluidas = seccion.filas.filter((f) => f.incluir).length;
            const todas = incluidas === seccion.filas.length;
            return (
              <section key={iSeccion} className="card overflow-hidden">
                <div className="card-pad !pb-4 space-y-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-bold text-foreground">{seccion.nombreOriginal ?? "Materias sin carrera detectada"}</h3>
                    <span className="text-xs font-bold text-foreground-muted tabular flex-shrink-0">
                      {incluidas} de {seccion.filas.length}
                    </span>
                  </div>
                  <div>
                    <label className="label" htmlFor={`imp-carrera-${iSeccion}`}>Guardar en</label>
                    <select
                      id={`imp-carrera-${iSeccion}`}
                      className="input"
                      value={seccion.carreraId}
                      onChange={(e) => actualizarSeccion(iSeccion, { carreraId: e.target.value })}
                    >
                      <option value={NUEVA_CARRERA}>Una carrera nueva</option>
                      {carreras.map((c) => <option key={c.id} value={c.id}>{c.nombre} (ya la tenés)</option>)}
                      <option value={SIN_CARRERA}>Ninguna carrera</option>
                    </select>
                    {seccion.carreraId === NUEVA_CARRERA && (
                      <input
                        className="input mt-2"
                        value={seccion.nombreNuevaCarrera}
                        onChange={(e) => actualizarSeccion(iSeccion, { nombreNuevaCarrera: e.target.value })}
                        placeholder="Nombre de la carrera"
                        aria-label="Nombre de la carrera nueva"
                        maxLength={200}
                      />
                    )}
                  </div>
                  <label className="flex items-center gap-2.5 text-sm font-semibold text-foreground-muted w-fit">
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      checked={todas}
                      ref={(el) => { if (el) el.indeterminate = incluidas > 0 && !todas; }}
                      onChange={(e) =>
                        actualizarSeccion(iSeccion, {
                          filas: seccion.filas.map((f) => ({ ...f, incluir: e.target.checked })),
                        })
                      }
                    />
                    {todas ? "Destildar todas" : "Tildar todas"}
                  </label>
                </div>

                <ul className="divide-y divide-card-border border-t border-card-border">
                  {seccion.filas.map((f, iFila) => (
                    <li key={`${f.nombre}-${iFila}`} className="flex items-center gap-3 px-4 sm:px-6 py-2.5 flex-wrap sm:flex-nowrap">
                      <label className="flex items-center gap-3 flex-1 min-w-0 basis-full sm:basis-auto" style={{ opacity: f.incluir ? 1 : 0.5 }}>
                        <input
                          type="checkbox"
                          className="w-4 h-4 flex-shrink-0"
                          checked={f.incluir}
                          onChange={(e) => actualizarFila(iSeccion, iFila, { incluir: e.target.checked })}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-foreground truncate">{f.nombre}</span>
                          <span className="block text-xs text-foreground-subtle truncate">
                            {[
                              f.codigo_interno,
                              f.año_plan ? `${f.año_plan}° año` : null,
                              f.periodo_texto,
                              f.correlativas_nombres?.length
                                ? `${f.correlativas_nombres.length} ${f.correlativas_nombres.length === 1 ? "correlativa" : "correlativas"}`
                                : null,
                            ].filter(Boolean).join(" · ") || "Sin más datos"}
                          </span>
                        </span>
                      </label>
                      {f.incluir && (
                        <div className="flex items-center gap-2 pl-7 sm:pl-0 flex-shrink-0">
                          <select
                            className="input input-sm"
                            style={{ width: "8.25rem" }}
                            value={f.estado}
                            onChange={(e) => actualizarFila(iSeccion, iFila, { estado: e.target.value as EstadoMateria })}
                            aria-label={`Estado de ${f.nombre}`}
                          >
                            {ESTADOS_ORDEN.map((e) => <option key={e} value={e}>{ESTADOS[e].label}</option>)}
                          </select>
                          <input
                            className="input input-sm tabular text-center font-bold"
                            style={{ width: "4.25rem" }}
                            inputMode="decimal"
                            defaultValue={f.nota ?? ""}
                            onBlur={(e) => {
                              const nota = parsearNota(e.target.value);
                              if (Number.isNaN(nota)) e.target.value = f.nota === null ? "" : String(f.nota);
                              else actualizarFila(iSeccion, iFila, { nota });
                            }}
                            placeholder="Nota"
                            aria-label={`Nota de ${f.nombre}`}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {/* Barra de acción pegada abajo: la lista puede ser muy larga */}
          <div className="sticky bottom-20 md:bottom-4 z-10 card p-3 flex gap-2" style={{ boxShadow: "var(--shadow-lg)" }}>
            <Link href="/materias" className="btn btn-secondary btn-lg">Cancelar</Link>
            <button
              type="button"
              onClick={handleImportar}
              disabled={estado === "importando" || totalIncluidas === 0}
              className="btn btn-primary btn-lg flex-1"
            >
              {estado === "importando" ? (
                <><Spinner /> Guardando, no cierres la pestaña...</>
              ) : totalIncluidas === 0 ? (
                "Tildá al menos una materia"
              ) : (
                `Traer ${totalIncluidas} ${totalIncluidas === 1 ? "materia" : "materias"}`
              )}
            </button>
          </div>
        </div>
      )}

      {estado === "hecho" && resultado && (
        <div className="card card-pad flex flex-col items-center text-center py-10 animate-fade-in">
          <span className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--color-primary-soft)" }}>
            <CheckCircle2 size={28} className="text-primary" />
          </span>
          <h2 className="font-display text-2xl font-semibold text-foreground">¡Listo, ya está todo!</h2>
          <p className="text-sm text-foreground-muted mt-1.5">
            {[
              resultado.creadas > 0 ? `${resultado.creadas} ${resultado.creadas === 1 ? "materia nueva" : "materias nuevas"}` : null,
              resultado.actualizadas > 0 ? `${resultado.actualizadas} ${resultado.actualizadas === 1 ? "actualizada" : "actualizadas"}` : null,
            ].filter(Boolean).join(" · ")}
          </p>
          <p className="text-sm text-foreground-muted mt-3 max-w-sm">
            Cuando tengas notas nuevas en SIU Guaraní, repetí la sincronización y se actualizan solas.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            <Link href="/" className="btn btn-primary">Ver mi avance</Link>
            <Link href="/materias/pasos" className="btn btn-secondary">Ver qué puedo cursar</Link>
          </div>
        </div>
      )}
    </main>
  );
}

function Pasos({ actual }: { actual: 1 | 2 | 3 }) {
  const pasos = ["Instalar", "Sincronizar", "Revisar"];
  return (
    <ol className="flex items-center gap-2 mb-5" aria-label={`Paso ${actual} de 3`}>
      {pasos.map((p, i) => {
        const n = i + 1;
        const hecho = n < actual;
        const activo = n === actual;
        return (
          <li key={p} className="flex items-center gap-2 flex-1 last:flex-none">
            <span
              className={`flex items-center gap-1.5 text-xs font-bold whitespace-nowrap ${
                activo ? "text-primary" : hecho ? "text-foreground-muted" : "text-foreground-subtle"
              }`}
              aria-current={activo ? "step" : undefined}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] tabular ${
                  activo ? "bg-primary text-primary-fg" : "bg-background-alt"
                }`}
              >
                {hecho ? "✓" : n}
              </span>
              {p}
            </span>
            {n < pasos.length && <span className="flex-1 h-px bg-card-border" />}
          </li>
        );
      })}
    </ol>
  );
}
