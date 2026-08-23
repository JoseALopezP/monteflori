"use client";

// src/app/(dashboard)/materias/importar/page.tsx
// Revisa y confirma los datos scrapeados por la extensión antes de guardarlos en Firestore.
// El scraper recorre todas las carreras del usuario, así que acá se revisa una sección por carrera.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Puzzle, RefreshCw, CheckCircle2, AlertCircle, Loader2,
  GraduationCap, ChevronLeft, Import,
} from "lucide-react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useCarreraActivaContext } from "@/components/dashboard/CarreraActivaProvider";
import { addCarrera, importarMateriasScrapeadas } from "@/lib/firestore";
import { sincronizarCalendar } from "@/lib/calendarCliente";
import { vincularConCatalogo, MateriaAVincular } from "@/lib/catalogoCliente";
import {
  extensionConfigurada, pingExtension, obtenerUltimaSincronizacion,
  limpiarUltimaSincronizacion, ScrapeData, MateriaScrapeada,
} from "@/lib/extensionSync";
import { EstadoMateria } from "@/types";

type Estado = "verificando" | "sin-extension" | "sin-datos" | "listo" | "importando" | "hecho";

const ESTADOS: EstadoMateria[] = ["cursando", "aprobada", "regular", "pendiente", "libre"];
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

export default function ImportarPage() {
  const { user } = useAuthContext();
  const router = useRouter();
  const { carreras, refetchCarreras } = useCarreraActivaContext();

  const [estado, setEstado] = useState<Estado>("verificando");
  const [scrapeData, setScrapeData] = useState<ScrapeData | null>(null);
  const [secciones, setSecciones] = useState<SeccionEditable[]>([]);
  const [resultado, setResultado] = useState<{ creadas: number; actualizadas: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!extensionConfigurada()) {
      setEstado("sin-extension");
      return;
    }
    pingExtension().then((disponible) => {
      if (!disponible) {
        setEstado("sin-extension");
        return;
      }
      obtenerUltimaSincronizacion().then((data) => {
        const totalMaterias = data?.carreras?.reduce((acc, c) => acc + c.materias.length, 0) ?? 0;
        if (!data || totalMaterias === 0) {
          setEstado("sin-datos");
          return;
        }
        setScrapeData(data);
        setSecciones(
          data.carreras.map((c) => {
            const match = c.carrera
              ? carreras.find((existente) => existente.nombre.trim().toLowerCase() === c.carrera!.trim().toLowerCase())
              : null;
            return {
              nombreOriginal: c.carrera,
              carreraId: match ? match.id : c.carrera ? NUEVA_CARRERA : SIN_CARRERA,
              nombreNuevaCarrera: c.carrera ?? "",
              filas: c.materias.map((m) => ({ ...m, incluir: true })),
            };
          })
        );
        setEstado("listo");
      });
    });
    // Solo al montar: no queremos re-pedir el sync si el usuario edita `carreras`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!user?.uid) return;
    setError(null);
    setEstado("importando");
    try {
      let creadasTotal = 0;
      let actualizadasTotal = 0;
      let seCrearonCarreras = false;
      const paraCatalogo: MateriaAVincular[] = [];

      for (const seccion of secciones) {
        let idCarreraFinal: string | null = null;
        if (seccion.carreraId === NUEVA_CARRERA) {
          if (seccion.nombreNuevaCarrera.trim()) {
            idCarreraFinal = await addCarrera(user.uid, {
              nombre: seccion.nombreNuevaCarrera.trim(),
              institucion: scrapeData?.universidad ?? "",
            });
            seCrearonCarreras = true;
          }
        } else if (seccion.carreraId !== SIN_CARRERA) {
          idCarreraFinal = seccion.carreraId;
        }

        const seleccionadas = seccion.filas.filter((f) => f.incluir);
        if (seleccionadas.length === 0) continue;

        // Traemos las materias existentes recién (no un hook compartido) porque
        // cada sección puede crear materias que la siguiente sección necesita
        // ver para no duplicar (ej. una materia compartida entre dos carreras).
        const { getMaterias } = await import("@/lib/firestore");
        const materiasExistentes = await getMaterias(user.uid);

        const res = await importarMateriasScrapeadas(user.uid, idCarreraFinal, seleccionadas, materiasExistentes);
        creadasTotal += res.creadas;
        actualizadasTotal += res.actualizadas;

        res.importadas.forEach((m) =>
          paraCatalogo.push({
            materia_id: m.id,
            nombre: m.nombre,
            codigo: m.codigo,
            carrera: seccion.nombreOriginal,
          })
        );
      }

      if (seCrearonCarreras) refetchCarreras();
      await limpiarUltimaSincronizacion();

      // Vincular con el catálogo compartido. El código que trae SIU es la mejor
      // clave de deduplicación que tenemos, así que acá no hace falta preguntar
      // nada: dos personas de la misma facultad caen en la misma entrada.
      if (user && scrapeData?.universidad) {
        await vincularConCatalogo(user, scrapeData.universidad, paraCatalogo);
      }

      // La importación puede traer fechas nuevas: que lleguen al calendario
      // sin esperar al repaso del día siguiente.
      if (user) sincronizarCalendar(user);
      setResultado({ creadas: creadasTotal, actualizadas: actualizadasTotal });
      setEstado("hecho");
    } catch {
      setError("Ocurrió un error al importar. Intentá de nuevo.");
      setEstado("listo");
    }
  }

  const inputStyle = {
    background: "var(--background-alt)",
    border: "1.5px solid var(--color-card-border)",
    color: "var(--foreground)",
    outline: "none",
    borderRadius: "var(--radius-md)",
    padding: "0.5rem 0.75rem",
    fontSize: "var(--font-size-sm)",
  };

  const cardStyle = {
    background: "var(--color-card)",
    borderColor: "var(--color-card-border)",
  };

  const totalFilas = secciones.reduce((acc, s) => acc + s.filas.length, 0);
  const totalIncluidas = secciones.reduce((acc, s) => acc + s.filas.filter((f) => f.incluir).length, 0);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-6">
          <Link href="/materias" className="text-sm mb-1 flex items-center gap-1 hover:underline"
            style={{ color: "var(--foreground-muted)" }}>
            <ChevronLeft size={14} /> Materias
          </Link>
          <h1 className="text-2xl font-extrabold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
            <Import size={22} style={{ color: "var(--color-primary)" }} />
            Importar desde SIU Guaraní
          </h1>
        </div>

        {estado === "verificando" && (
          <div className="rounded-2xl p-8 border text-center flex flex-col items-center gap-3" style={cardStyle}>
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-primary)" }} />
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Buscando la extensión...</p>
          </div>
        )}

        {estado === "sin-extension" && (
          <div className="rounded-2xl p-8 border text-center flex flex-col items-center gap-3" style={cardStyle}>
            <Puzzle size={36} style={{ color: "var(--foreground-subtle)" }} />
            <p className="font-bold" style={{ color: "var(--foreground)" }}>No detectamos la extensión Monteflori Sync</p>
            <p className="text-sm max-w-sm" style={{ color: "var(--foreground-muted)" }}>
              Necesitás instalarla una vez para poder sincronizar tus materias automáticamente.
            </p>
            <Link href="/extension"
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{ background: "var(--color-primary)", color: "white" }}>
              Ver instrucciones de instalación
            </Link>
          </div>
        )}

        {estado === "sin-datos" && (
          <div className="rounded-2xl p-8 border text-center flex flex-col items-center gap-3" style={cardStyle}>
            <RefreshCw size={32} style={{ color: "var(--foreground-subtle)" }} />
            <p className="font-bold" style={{ color: "var(--foreground)" }}>Todavía no hay datos sincronizados</p>
            <p className="text-sm max-w-sm" style={{ color: "var(--foreground-muted)" }}>
              Abrí SIU Guaraní y usá el botón &quot;Sincronizar ahora&quot; del ícono de la extensión.
              Recorre todas tus carreras automáticamente, puede tardar uno o dos minutos.
            </p>
          </div>
        )}

        {(estado === "listo" || estado === "importando") && scrapeData && (
          <div className="space-y-4">
            <div className="rounded-2xl p-4 border flex items-center gap-3" style={cardStyle}>
              <CheckCircle2 size={20} style={{ color: "var(--color-success)" }} />
              <div className="text-sm" style={{ color: "var(--foreground)" }}>
                <strong>{totalFilas}</strong> materias detectadas en <strong>{secciones.length}</strong> carrera{secciones.length !== 1 ? "s" : ""}
                {" "}({scrapeData.universidad})
              </div>
            </div>

            {scrapeData.errores && scrapeData.errores.length > 0 && (
              <div className="p-3 rounded-xl text-sm"
                style={{ background: "var(--estado-cursando-bg)", color: "var(--estado-cursando)" }}>
                <p className="font-semibold mb-1">
                  {scrapeData.errores.length} {scrapeData.errores.length === 1 ? "problema" : "problemas"} durante la sincronización (se importó igual el resto):
                </p>
                <ul className="list-disc list-inside space-y-0.5">
                  {scrapeData.errores.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl flex items-center gap-2 text-sm font-medium"
                style={{ background: "var(--estado-libre-bg)", color: "var(--color-alert)" }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            {secciones.map((seccion, iSeccion) => (
              <div key={iSeccion} className="rounded-2xl border overflow-hidden" style={cardStyle}>
                <div className="p-4 border-b" style={{ borderColor: "var(--color-card-border)" }}>
                  <p className="font-bold text-sm mb-3" style={{ color: "var(--foreground)" }}>
                    {seccion.nombreOriginal ?? "Sin carrera detectada"}
                    <span className="ml-2 font-normal text-xs" style={{ color: "var(--foreground-subtle)" }}>
                      {seccion.filas.length} materias
                    </span>
                  </p>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                    <GraduationCap size={12} className="inline mr-1" />
                    Vincular a la carrera
                  </label>
                  <select
                    value={seccion.carreraId}
                    onChange={(e) => actualizarSeccion(iSeccion, { carreraId: e.target.value })}
                    style={{ ...inputStyle, width: "100%" }}
                  >
                    <option value={SIN_CARRERA}>Sin vincular a ninguna carrera</option>
                    {carreras.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                    <option value={NUEVA_CARRERA}>+ Crear nueva carrera</option>
                  </select>
                  {seccion.carreraId === NUEVA_CARRERA && (
                    <input
                      className="mt-2"
                      style={{ ...inputStyle, width: "100%" }}
                      value={seccion.nombreNuevaCarrera}
                      onChange={(e) => actualizarSeccion(iSeccion, { nombreNuevaCarrera: e.target.value })}
                      placeholder="Nombre de la nueva carrera"
                    />
                  )}
                </div>

                <div className="divide-y" style={{ borderColor: "var(--color-card-border)" }}>
                  {seccion.filas.map((f, iFila) => (
                    <div key={`${f.nombre}-${iFila}`} className="flex items-center gap-3 p-3"
                      style={{ opacity: f.incluir ? 1 : 0.45 }}>
                      <input
                        type="checkbox"
                        checked={f.incluir}
                        onChange={(e) => actualizarFila(iSeccion, iFila, { incluir: e.target.checked })}
                        className="w-4 h-4 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>
                          {f.nombre}
                        </p>
                        <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                          {f.codigo_interno ?? "—"} · {f.periodo_texto ?? "sin período"}
                          {f.año_plan ? ` · Año ${f.año_plan}` : ""}
                          {f.fecha_aprobacion ? ` · aprobada ${f.fecha_aprobacion}` : ""}
                        </p>
                      </div>
                      <select
                        value={f.estado}
                        onChange={(e) => actualizarFila(iSeccion, iFila, { estado: e.target.value as EstadoMateria })}
                        style={{ ...inputStyle, fontSize: "12px", padding: "0.4rem 0.5rem" }}
                      >
                        {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                      </select>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={0.5}
                        value={f.nota ?? ""}
                        onChange={(e) => actualizarFila(iSeccion, iFila, { nota: e.target.value ? Number(e.target.value) : null })}
                        placeholder="Nota"
                        style={{ ...inputStyle, width: "4.5rem", fontSize: "12px", padding: "0.4rem 0.5rem" }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex gap-3">
              <Link href="/materias"
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-center border transition-all hover:opacity-75"
                style={{ borderColor: "var(--color-card-border)", color: "var(--foreground-muted)" }}>
                Cancelar
              </Link>
              <button
                onClick={handleImportar}
                disabled={estado === "importando" || totalIncluidas === 0}
                className="flex-1 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: "var(--color-primary)", color: "white" }}
              >
                {estado === "importando"
                  ? <><Loader2 size={16} className="animate-spin" /> Importando...</>
                  : `Importar ${totalIncluidas} materias`}
              </button>
            </div>
          </div>
        )}

        {estado === "hecho" && resultado && (
          <div className="rounded-2xl p-8 border text-center flex flex-col items-center gap-3" style={cardStyle}>
            <CheckCircle2 size={40} style={{ color: "var(--color-success)" }} />
            <p className="font-bold text-lg" style={{ color: "var(--foreground)" }}>¡Importación completa!</p>
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
              {resultado.creadas} materias creadas · {resultado.actualizadas} actualizadas
            </p>
            <button
              onClick={() => router.push("/materias")}
              className="mt-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{ background: "var(--color-primary)", color: "white" }}
            >
              Ver mis materias
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
