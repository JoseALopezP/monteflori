"use client";

// src/app/(dashboard)/admin/moderacion/page.tsx
// Panel para revisar comentarios reportados.
//
// El permiso real lo chequea la API contra ADMIN_UIDS: esconder la pantalla no
// es seguridad. Si alguien que no es admin entra, la API devuelve 404 y acá se
// ve el mismo "no encontrado" que en cualquier ruta inexistente.

import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Trash2, Flag, ShieldCheck } from "lucide-react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useConfirm, useToast } from "@/components/ui/Feedback";
import { EmptyState, Esqueleto, PageHeader, Spinner } from "@/components/ui/kit";

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
  const toast = useToast();
  const confirmar = useConfirm();

  const cargar = useCallback(async () => {
    if (!user) return;
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
    if (accion === "eliminar") {
      const ok = await confirmar({
        titulo: "¿Eliminar este comentario?",
        mensaje: "Se borra definitivamente. No se puede deshacer.",
      });
      if (!ok) return;
    }

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
      if (res.ok) {
        setComentarios((prev) => prev.filter((x) => x.id !== c.id));
        toast(accion === "eliminar" ? "Comentario eliminado" : "Comentario restaurado");
      } else {
        toast("No se pudo completar la acción", "error");
      }
    } finally {
      setProcesando(null);
    }
  }

  if (sinAcceso) {
    return (
      <main className="page page-narrow">
        <p className="text-sm text-foreground-muted text-center py-16">Página no encontrada.</p>
      </main>
    );
  }

  return (
    <main className="page page-narrow">
      <PageHeader
        titulo="Moderación"
        subtitulo="Comentarios reportados. Los que llegaron al umbral ya están ocultos."
      />

      {cargando ? (
        <Esqueleto filas={2} alto="h-28" />
      ) : comentarios.length === 0 ? (
        <EmptyState icono={<ShieldCheck size={22} />} titulo="No hay nada reportado" texto="Todo tranquilo." />
      ) : (
        <ul className="space-y-3">
          {comentarios.map((c) => (
            <li key={c.id} className="card card-pad">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-sm font-bold text-foreground">{c.autor_alias}</span>
                <span className="badge" style={{ background: "var(--estado-libre-bg)", color: "var(--color-alert)" }}>
                  <Flag size={10} /> {c.reportes} {c.reportes === 1 ? "reporte" : "reportes"}
                </span>
                {c.oculto && <span className="badge">Oculto</span>}
                <span className="text-xs text-foreground-subtle">{new Date(c.creado_en).toLocaleString("es-AR")}</span>
              </div>

              <p className="text-sm whitespace-pre-wrap break-words text-foreground mb-4">{c.texto}</p>

              <div className="flex gap-2">
                <button type="button" onClick={() => actuar(c, "restaurar")} disabled={procesando === c.id} className="btn btn-secondary btn-sm">
                  {procesando === c.id ? <Spinner size={13} /> : <RotateCcw size={13} />}
                  Está bien, restaurar
                </button>
                <button type="button" onClick={() => actuar(c, "eliminar")} disabled={procesando === c.id} className="btn btn-danger-ghost btn-sm">
                  <Trash2 size={13} /> Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
