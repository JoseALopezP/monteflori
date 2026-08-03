"use client";

// src/app/(dashboard)/materias/importar/page.tsx
// Revisa y confirma los datos scrapeados por la extensión antes de guardarlos en Firestore.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Puzzle, RefreshCw, CheckCircle2, AlertCircle, Loader2,
  GraduationCap, ChevronLeft, Import,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useCarreras } from "@/hooks/useCarreras";
import { useMaterias } from "@/hooks/useMaterias";
import { addCarrera, importarMateriasScrapeadas } from "@/lib/firestore";
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

function ImportarContent() {
  const { user } = useAuthContext();
  const router = useRouter();
  const { carreras } = useCarreras(user?.uid ?? null);
  const { materias: materiasExistentes } = useMaterias(user?.uid ?? null);

  const [estado, setEstado] = useState<Estado>("verificando");
  const [scrapeData, setScrapeData] = useState<ScrapeData | null>(null);
  const [filas, setFilas] = useState<FilaEditable[]>([]);
  const [carreraId, setCarreraId] = useState<string>(SIN_CARRERA);
  const [nombreNuevaCarrera, setNombreNuevaCarrera] = useState("");
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
        if (!data || data.materias.length === 0) {
          setEstado("sin-datos");
          return;
        }
        setScrapeData(data);
        setFilas(data.materias.map((m) => ({ ...m, incluir: true })));

        if (data.carrera) {
          const match = carreras.find(
            (c) => c.nombre.trim().toLowerCase() === data.carrera!.trim().toLowerCase()
          );
          setCarreraId(match ? match.id : NUEVA_CARRERA);
          setNombreNuevaCarrera(data.carrera);
        }
        setEstado("listo");
      });
    });
    // Solo al montar: no queremos re-pedir el sync si el usuario edita `carreras`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function actualizarFila(i: number, cambios: Partial<FilaEditable>) {
    setFilas((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...cambios } : f)));
  }

  async function handleImportar() {
    if (!user?.uid) return;
    setError(null);
    setEstado("importando");
    try {
      let idCarreraFinal: string | null = null;
      if (carreraId === NUEVA_CARRERA) {
        if (nombreNuevaCarrera.trim()) {
          idCarreraFinal = await addCarrera(user.uid, {
            nombre: nombreNuevaCarrera.trim(),
            institucion: scrapeData?.universidad ?? "",
          });
        }
      } else if (carreraId !== SIN_CARRERA) {
        idCarreraFinal = carreraId;
      }

      const seleccionadas = filas.filter((f) => f.incluir);
      const res = await importarMateriasScrapeadas(
        user.uid,
        idCarreraFinal,
        seleccionadas,
        materiasExistentes
      );
      await limpiarUltimaSincronizacion();
      setResultado(res);
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
              Abrí el Plan de estudio en el portal de tu universidad y usá el botón
              &quot;Sincronizar ahora&quot; del ícono de la extensión.
            </p>
          </div>
        )}

        {(estado === "listo" || estado === "importando") && scrapeData && (
          <div className="space-y-4">
            <div className="rounded-2xl p-4 border flex items-center gap-3" style={cardStyle}>
              <CheckCircle2 size={20} style={{ color: "var(--color-success)" }} />
              <div className="text-sm" style={{ color: "var(--foreground)" }}>
                <strong>{filas.length}</strong> materias detectadas
                {scrapeData.carrera ? <> en <strong>{scrapeData.carrera}</strong></> : null}
                {" "}({scrapeData.universidad})
              </div>
            </div>

            {scrapeData.errores && scrapeData.errores.length > 0 && (
              <div className="p-3 rounded-xl text-sm"
                style={{ background: "var(--estado-cursando-bg)", color: "var(--estado-cursando)" }}>
                <p className="font-semibold mb-1">
                  {scrapeData.errores.length} {scrapeData.errores.length === 1 ? "materia tuvo" : "materias tuvieron"} un problema al leerse (se importó igual el resto):
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

            <div className="rounded-2xl p-5 border" style={cardStyle}>
              <label className="block text-sm font-semibold mb-2" style={{ color: "var(--foreground-muted)" }}>
                <GraduationCap size={14} className="inline mr-1" />
                Vincular a la carrera
              </label>
              <select value={carreraId} onChange={(e) => setCarreraId(e.target.value)} style={{ ...inputStyle, width: "100%" }}>
                <option value={SIN_CARRERA}>Sin vincular a ninguna carrera</option>
                {carreras.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
                <option value={NUEVA_CARRERA}>+ Crear nueva carrera</option>
              </select>
              {carreraId === NUEVA_CARRERA && (
                <input
                  className="mt-2"
                  style={{ ...inputStyle, width: "100%" }}
                  value={nombreNuevaCarrera}
                  onChange={(e) => setNombreNuevaCarrera(e.target.value)}
                  placeholder="Nombre de la nueva carrera"
                />
              )}
            </div>

            <div className="rounded-2xl border overflow-hidden" style={cardStyle}>
              <div className="divide-y" style={{ borderColor: "var(--color-card-border)" }}>
                {filas.map((f, i) => (
                  <div key={`${f.nombre}-${i}`} className="flex items-center gap-3 p-3"
                    style={{ opacity: f.incluir ? 1 : 0.45 }}>
                    <input
                      type="checkbox"
                      checked={f.incluir}
                      onChange={(e) => actualizarFila(i, { incluir: e.target.checked })}
                      className="w-4 h-4 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>
                        {f.nombre}
                      </p>
                      <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                        {f.codigo_interno ?? "—"} · {f.periodo_texto ?? "sin período"}
                        {f.año_plan ? ` · Año ${f.año_plan}` : ""}
                      </p>
                    </div>
                    <select
                      value={f.estado}
                      onChange={(e) => actualizarFila(i, { estado: e.target.value as EstadoMateria })}
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
                      onChange={(e) => actualizarFila(i, { nota: e.target.value ? Number(e.target.value) : null })}
                      placeholder="Nota"
                      style={{ ...inputStyle, width: "4.5rem", fontSize: "12px", padding: "0.4rem 0.5rem" }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Link href="/materias"
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-center border transition-all hover:opacity-75"
                style={{ borderColor: "var(--color-card-border)", color: "var(--foreground-muted)" }}>
                Cancelar
              </Link>
              <button
                onClick={handleImportar}
                disabled={estado === "importando" || filas.every((f) => !f.incluir)}
                className="flex-1 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: "var(--color-primary)", color: "white" }}
              >
                {estado === "importando"
                  ? <><Loader2 size={16} className="animate-spin" /> Importando...</>
                  : `Importar ${filas.filter((f) => f.incluir).length} materias`}
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

export default function ImportarPage() {
  return <AuthGuard><ImportarContent /></AuthGuard>;
}
