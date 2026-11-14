"use client";

// src/components/comentarios/Comentarios.tsx
// Comentarios de estudiantes sobre una materia del catálogo compartido.
//
// Se leen directo de Firestore (son públicos para usuarios autenticados) y se
// escriben siempre por la API, que es donde vive la validación de verdad.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, ThumbsUp, ThumbsDown, Flag, Send, EyeOff } from "lucide-react";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { usePerfil } from "@/hooks/usePerfil";
import { useConfirm, useToast } from "@/components/ui/Feedback";
import { Esqueleto, Spinner } from "@/components/ui/kit";
import { validarComentario, TEXTO_MAX } from "@/lib/comentarios";
import { Comentario } from "@/types";

interface ComentariosProps {
  catalogoId: string;
  carreraContexto?: string | null;
}

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return fecha.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

function dominio(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
}

async function traerComentarios(catalogoId: string): Promise<Comentario[]> {
  try {
    const q = query(
      collection(db, "catalogo_materias", catalogoId, "comentarios"),
      where("oculto", "==", false),
      orderBy("puntaje", "desc"),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Comentario);
  } catch {
    // Falta el índice compuesto o no hay permisos: no rompemos la página.
    return [];
  }
}

export function Comentarios({ catalogoId, carreraContexto }: ComentariosProps) {
  const { user } = useAuthContext();
  const { perfil } = usePerfil();
  const toast = useToast();
  const confirmar = useConfirm();

  // Los comentarios recuerdan de qué materia son: al cambiar de materia, lo
  // anterior deja de mostrarse sin tener que limpiarlo a mano.
  const [carga, setCarga] = useState<{ de: string; lista: Comentario[] } | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [misVotos, setMisVotos] = useState<Record<string, number>>({});
  const [reportados, setReportados] = useState<Set<string>>(new Set());

  const tieneAlias = !!perfil?.perfil?.alias?.trim();
  const cargando = carga?.de !== catalogoId;
  const comentarios = cargando ? [] : carga.lista;

  const cargar = useCallback(async () => {
    const lista = await traerComentarios(catalogoId);
    setCarga({ de: catalogoId, lista });
  }, [catalogoId]);

  useEffect(() => {
    let vigente = true;
    traerComentarios(catalogoId).then((lista) => {
      if (vigente) setCarga({ de: catalogoId, lista });
    });
    return () => { vigente = false; };
  }, [catalogoId]);

  function actualizarLista(cambio: (lista: Comentario[]) => Comentario[]) {
    setCarga((prev) => (prev ? { ...prev, lista: cambio(prev.lista) } : prev));
  }

  // Validación local para dar feedback inmediato. La que decide es la del
  // servidor: esta se puede saltear desde la consola.
  const previa = texto.trim().length > 0 ? validarComentario(texto) : null;

  async function llamarApi(ruta: string, cuerpo: Record<string, unknown>) {
    const token = await user!.getIdToken();
    return fetch(ruta, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ materia_catalogo_id: catalogoId, ...cuerpo }),
    });
  }

  async function publicar() {
    if (!user) return;
    setError(null);
    setEnviando(true);
    try {
      const res = await llamarApi("/api/comentarios", { texto, carrera_contexto: carreraContexto ?? null });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? "No se pudo publicar.");
      setTexto("");
      toast("Comentario publicado");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo publicar.");
    } finally {
      setEnviando(false);
    }
  }

  async function votar(comentarioId: string, valor: 1 | -1) {
    if (!user) return;
    try {
      const res = await llamarApi("/api/comentarios/votar", { comentario_id: comentarioId, valor });
      if (!res.ok) return;
      const datos = await res.json();
      setMisVotos((prev) => ({ ...prev, [comentarioId]: datos.mi_voto }));
      actualizarLista((lista) =>
        lista.map((c) =>
          c.id === comentarioId
            ? {
                ...c,
                votos_positivos: datos.votos_positivos,
                votos_negativos: datos.votos_negativos,
                puntaje: datos.votos_positivos - datos.votos_negativos,
              }
            : c
        )
      );
    } catch {
      // Un voto que no entra no justifica interrumpir la lectura.
    }
  }

  async function reportar(comentarioId: string) {
    if (!user) return;
    const ok = await confirmar({
      titulo: "¿Reportar este comentario?",
      mensaje: "Lo vamos a revisar. Usalo para spam, insultos o datos personales.",
      accion: "Reportar",
    });
    if (!ok) return;
    try {
      const res = await llamarApi("/api/comentarios/reportar", { comentario_id: comentarioId });
      if (!res.ok) {
        toast("No se pudo reportar. Probá de nuevo.", "error");
        return;
      }
      const datos = await res.json();
      setReportados((prev) => new Set(prev).add(comentarioId));
      toast("Gracias, lo vamos a revisar");
      if (datos.oculto) actualizarLista((lista) => lista.filter((c) => c.id !== comentarioId));
    } catch {
      toast("No se pudo reportar. Probá de nuevo.", "error");
    }
  }

  return (
    <section className="card card-pad">
      <h2 className="section-title flex items-center gap-2">
        <MessageSquare size={17} className="text-secondary" />
        Lo que dicen otros estudiantes
      </h2>
      <p className="text-sm text-foreground-muted mt-1 mb-4">
        Experiencias de quienes ya la cursaron. Se publica con tu apodo, nunca con tu nombre.
      </p>

      {!tieneAlias ? (
        <p className="notice mb-4">
          <span>
            Para comentar necesitás un apodo.{" "}
            <Link href="/perfil" className="link">Elegí uno en tu perfil</Link>.
          </span>
        </p>
      ) : (
        <div className="mb-5">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            maxLength={TEXTO_MAX}
            placeholder="¿Cómo es cursarla? ¿Qué conviene saber antes de arrancar?"
            className="input"
            aria-label="Tu comentario"
          />
          <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
            <p className="text-xs text-foreground-subtle">
              <span className="tabular">{texto.length}/{TEXTO_MAX}</span> · Podés incluir links de Drive, Docs,
              YouTube o GitHub
            </p>
            <button
              type="button"
              onClick={publicar}
              disabled={enviando || !previa?.valido}
              className="btn btn-primary btn-sm"
            >
              {enviando ? <Spinner size={14} /> : <Send size={14} />}
              Publicar
            </button>
          </div>

          {previa && !previa.valido && texto.trim().length >= 10 && (
            <p className="text-xs mt-1.5 font-semibold text-alert">{previa.error}</p>
          )}
          {error && <p className="text-xs mt-1.5 font-semibold text-alert" role="alert">{error}</p>}
        </div>
      )}

      {cargando ? (
        <Esqueleto filas={2} />
      ) : comentarios.length === 0 ? (
        <p className="text-sm text-center py-6 text-foreground-subtle">
          Todavía no hay comentarios. Si ya la cursaste, tu experiencia le sirve al que viene.
        </p>
      ) : (
        <ul className="space-y-3">
          {comentarios.map((c) => (
            <li key={c.id} className="p-3.5 rounded-[var(--radius-md)] bg-background-alt">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="text-sm font-bold text-foreground">{c.autor_alias}</span>
                <span className="text-xs text-foreground-subtle">{formatearFecha(c.creado_en)}</span>
                {c.carrera_contexto && <span className="badge !bg-card">{c.carrera_contexto}</span>}
              </div>

              <p className="text-sm whitespace-pre-wrap break-words text-foreground">{c.texto}</p>

              {c.links?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {c.links.map((l) => (
                    <a
                      key={l}
                      href={l}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="link text-xs px-2 py-1 rounded-[var(--radius-sm)] bg-card break-all"
                    >
                      {dominio(l)}
                    </a>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1 mt-2.5 -ml-2">
                <button
                  type="button"
                  onClick={() => votar(c.id, 1)}
                  className="btn btn-ghost btn-sm tabular"
                  style={misVotos[c.id] === 1 ? { color: "var(--estado-aprobada)" } : undefined}
                  aria-label={`Me sirvió (${c.votos_positivos})`}
                  aria-pressed={misVotos[c.id] === 1}
                >
                  <ThumbsUp size={14} /> {c.votos_positivos}
                </button>
                <button
                  type="button"
                  onClick={() => votar(c.id, -1)}
                  className="btn btn-ghost btn-sm tabular"
                  style={misVotos[c.id] === -1 ? { color: "var(--color-alert)" } : undefined}
                  aria-label={`No me sirvió (${c.votos_negativos})`}
                  aria-pressed={misVotos[c.id] === -1}
                >
                  <ThumbsDown size={14} /> {c.votos_negativos}
                </button>

                <div className="flex-1" />

                <button
                  type="button"
                  onClick={() => reportar(c.id)}
                  disabled={reportados.has(c.id)}
                  className="btn btn-ghost btn-sm !font-semibold"
                >
                  {reportados.has(c.id) ? <EyeOff size={13} /> : <Flag size={13} />}
                  {reportados.has(c.id) ? "Reportado" : "Reportar"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
