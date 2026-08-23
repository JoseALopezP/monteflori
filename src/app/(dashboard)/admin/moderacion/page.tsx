"use client";

// src/app/(dashboard)/admin/moderacion/page.tsx
// Panel para revisar comentarios reportados.
//
// El permiso real lo chequea la API contra ADMIN_UIDS: esconder la pantalla no
// es seguridad. Si alguien que no es admin entra, la API devuelve 404 y acá se
// ve el mismo "no encontrado" que en cualquier ruta inexistente.

import { useCallback, useEffect, useState } from "react";
import { Shield, Loader2, RotateCcw, Trash2, Flag } from "lucide-react";
import { useAuthContext } from "@/components/auth/AuthProvider";

interface ComentarioReportado {
  id: string;
  materia_catalogo_id: string | null;
  autor_alias: string;
  texto: string;
  creado_en: string;
  reportes: number;
  oculto: boolean;
}

export default function ModeracionPage() {
  const { user } = useAuthContext();
  const [comentarios, setComentarios] = useState<ComentarioReportado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sinAcceso, setSinAcceso] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!user) return;
    setCargando(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/moderacion", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 404) {
        setSinAcceso(true);
        return;
      }
      const datos = await res.json();
      setComentarios(datos.comentarios ?? []);
    } finally {
      setCargando(false);
    }
  }, [user]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function actuar(c: ComentarioReportado, accion: "restaurar" | "eliminar") {
    if (!user || !c.materia_catalogo_id) return;
    if (accion === "eliminar" && !confirm("¿Eliminar este comentario definitivamente?")) return;

    setProcesando(c.id);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/moderacion", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          materia_catalogo_id: c.materia_catalogo_id,
          comentario_id: c.id,
          accion,
        }),
      });
      if (res.ok) setComentarios((prev) => prev.filter((x) => x.id !== c.id));
    } finally {
      setProcesando(null);
    }
  }

  if (sinAcceso) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
          Página no encontrada.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
            <Shield size={22} style={{ color: "var(--color-primary)" }} />
            Moderación
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
            Comentarios reportados. Los que llegaron al umbral ya están ocultos.
          </p>
        </div>

        {cargando ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
          </div>
        ) : comentarios.length === 0 ? (
          <div className="rounded-2xl p-8 border text-center"
            style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
              No hay nada reportado. Todo tranquilo.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {comentarios.map((c) => (
              <div key={c.id} className="rounded-2xl p-4 border"
                style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                    {c.autor_alias}
                  </span>
                  <span className="text-xs flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{ background: "var(--estado-libre-bg)", color: "var(--color-alert)" }}>
                    <Flag size={10} /> {c.reportes}
                  </span>
                  {c.oculto && (
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "var(--background-alt)", color: "var(--foreground-subtle)" }}>
                      Oculto
                    </span>
                  )}
                  <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                    {new Date(c.creado_en).toLocaleString("es-AR")}
                  </span>
                </div>

                <p className="text-sm whitespace-pre-wrap break-words mb-3"
                  style={{ color: "var(--foreground)" }}>
                  {c.texto}
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => actuar(c, "restaurar")}
                    disabled={procesando === c.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:opacity-80 disabled:opacity-50"
                    style={{ borderColor: "var(--color-card-border)", color: "var(--foreground)" }}>
                    {procesando === c.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                    Restaurar
                  </button>
                  <button
                    onClick={() => actuar(c, "eliminar")}
                    disabled={procesando === c.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:opacity-80 disabled:opacity-50"
                    style={{ borderColor: "var(--color-card-border)", color: "var(--color-alert)" }}>
                    <Trash2 size={12} />
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
