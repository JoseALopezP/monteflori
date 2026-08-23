"use client";

// src/components/comentarios/Comentarios.tsx
// Comentarios de estudiantes sobre una materia del catálogo compartido.
//
// Se leen directo de Firestore (son públicos para usuarios autenticados) y se
// escriben siempre por la API, que es donde vive la validación de verdad.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  MessageSquare, ThumbsUp, ThumbsDown, Flag, Loader2, Send, EyeOff,
} from "lucide-react";
import {
  collection, getDocs, limit, orderBy, query, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { usePerfil } from "@/hooks/usePerfil";
import { validarComentario, TEXTO_MAX } from "@/lib/comentarios";
import { Comentario } from "@/types";

interface ComentariosProps {
  catalogoId: string;
  carreraContexto?: string | null;
}

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return fecha.toLocaleString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Comentarios({ catalogoId, carreraContexto }: ComentariosProps) {
  const { user } = useAuthContext();
  const { perfil } = usePerfil(user?.uid ?? null);

  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [misVotos, setMisVotos] = useState<Record<string, number>>({});
  const [reportados, setReportados] = useState<Set<string>>(new Set());

  const tieneAlias = !!perfil?.perfil?.alias?.trim();

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const q = query(
        collection(db, "catalogo_materias", catalogoId, "comentarios"),
        where("oculto", "==", false),
        orderBy("puntaje", "desc"),
        limit(50)
      );
      const snap = await getDocs(q);
      setComentarios(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Comentario));
    } catch {
      // Falta el índice compuesto o no hay permisos: no rompemos la página.
      setComentarios([]);
    } finally {
      setCargando(false);
    }
  }, [catalogoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Validación local para dar feedback inmediato. La que decide es la del
  // servidor: esta se puede saltear desde la consola.
  const previa = texto.trim().length > 0 ? validarComentario(texto) : null;

  async function publicar() {
    if (!user) return;
    setError(null);
    setEnviando(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/comentarios", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          materia_catalogo_id: catalogoId,
          texto,
          carrera_contexto: carreraContexto ?? null,
        }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? "No se pudo publicar.");
      setTexto("");
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
      const token = await user.getIdToken();
      const res = await fetch("/api/comentarios/votar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ materia_catalogo_id: catalogoId, comentario_id: comentarioId, valor }),
      });
      if (!res.ok) return;
      const datos = await res.json();
      setMisVotos((prev) => ({ ...prev, [comentarioId]: datos.mi_voto }));
      setComentarios((prev) =>
        prev.map((c) =>
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
    if (!confirm("¿Reportar este comentario para que lo revisemos?")) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/comentarios/reportar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ materia_catalogo_id: catalogoId, comentario_id: comentarioId }),
      });
      if (!res.ok) return;
      const datos = await res.json();
      setReportados((prev) => new Set(prev).add(comentarioId));
      if (datos.oculto) {
        setComentarios((prev) => prev.filter((c) => c.id !== comentarioId));
      }
    } catch {
      // idem
    }
  }

  const cardStyle = {
    background: "var(--color-card)",
    borderColor: "var(--color-card-border)",
  };

  return (
    <div className="rounded-2xl p-6 border shadow-sm" style={cardStyle}>
      <h2 className="text-lg font-bold flex items-center gap-2 mb-1" style={{ color: "var(--foreground)" }}>
        <MessageSquare size={18} style={{ color: "var(--color-secondary)" }} />
        Comentarios de estudiantes
      </h2>
      <p className="text-xs mb-4" style={{ color: "var(--foreground-subtle)" }}>
        Lo que dejan otros estudiantes que cursaron esta materia. Se publica con tu apodo,
        no con tu nombre.
      </p>

      {/* Formulario */}
      {!tieneAlias ? (
        <div className="p-3.5 rounded-xl mb-4" style={{ background: "var(--background-alt)" }}>
          <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
            Para comentar necesitás un apodo.{" "}
            <Link href="/perfil" className="font-semibold hover:underline" style={{ color: "var(--color-primary)" }}>
              Elegí uno en tu perfil
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mb-5">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            maxLength={TEXTO_MAX}
            placeholder="¿Cómo es cursarla? ¿Qué conviene saber antes de arrancar?"
            className="w-full px-3.5 py-3 rounded-xl text-sm"
            style={{
              background: "var(--background-alt)",
              border: "1.5px solid var(--color-card-border)",
              color: "var(--foreground)",
              outline: "none",
              resize: "vertical",
            }}
          />
          <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
            <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
              {texto.length}/{TEXTO_MAX} · Podés incluir links de Drive, Docs, YouTube o GitHub
            </p>
            <button
              onClick={publicar}
              disabled={enviando || !previa?.valido}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: "var(--color-primary)", color: "white" }}
            >
              {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Publicar
            </button>
          </div>

          {previa && !previa.valido && texto.trim().length >= 10 && (
            <p className="text-xs mt-1.5 font-medium" style={{ color: "var(--color-alert)" }}>
              {previa.error}
            </p>
          )}
          {error && (
            <p className="text-xs mt-1.5 font-medium" style={{ color: "var(--color-alert)" }}>
              {error}
            </p>
          )}
        </div>
      )}

      {/* Lista */}
      {cargando ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : comentarios.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: "var(--foreground-subtle)" }}>
          Todavía no hay comentarios. Si ya la cursaste, tu experiencia le sirve al que viene.
        </p>
      ) : (
        <div className="space-y-3">
          {comentarios.map((c) => (
            <div key={c.id} className="p-3.5 rounded-xl" style={{ background: "var(--background-alt)" }}>
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                  {c.autor_alias}
                </span>
                <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                  {formatearFecha(c.creado_en)}
                </span>
                {c.carrera_contexto && (
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "var(--color-card)", color: "var(--foreground-subtle)" }}>
                    {c.carrera_contexto}
                  </span>
                )}
              </div>

              <p className="text-sm whitespace-pre-wrap break-words" style={{ color: "var(--foreground)" }}>
                {c.texto}
              </p>

              {c.links?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {c.links.map((l) => (
                    <a
                      key={l}
                      href={l}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-xs font-semibold px-2 py-1 rounded-lg hover:underline break-all"
                      style={{ background: "var(--color-card)", color: "var(--color-secondary)" }}
                    >
                      {(() => {
                        try {
                          return new URL(l).hostname.replace(/^www\./, "");
                        } catch {
                          return l;
                        }
                      })()}
                    </a>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1 mt-2.5">
                <button
                  onClick={() => votar(c.id, 1)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all hover:opacity-75"
                  style={{
                    color: misVotos[c.id] === 1 ? "var(--estado-aprobada)" : "var(--foreground-subtle)",
                  }}
                  aria-label="Me sirve"
                >
                  <ThumbsUp size={13} /> {c.votos_positivos}
                </button>
                <button
                  onClick={() => votar(c.id, -1)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all hover:opacity-75"
                  style={{
                    color: misVotos[c.id] === -1 ? "var(--color-alert)" : "var(--foreground-subtle)",
                  }}
                  aria-label="No me sirve"
                >
                  <ThumbsDown size={13} /> {c.votos_negativos}
                </button>

                <div className="flex-1" />

                <button
                  onClick={() => reportar(c.id)}
                  disabled={reportados.has(c.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all hover:opacity-75 disabled:opacity-40"
                  style={{ color: "var(--foreground-subtle)" }}
                  aria-label="Reportar comentario"
                >
                  {reportados.has(c.id) ? <EyeOff size={13} /> : <Flag size={13} />}
                  {reportados.has(c.id) ? "Reportado" : "Reportar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
