"use client";

// src/app/(dashboard)/configuracion/page.tsx
// Configuración completa del usuario

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Settings, Calendar, Moon, Sun, Monitor,
  Check, ExternalLink, Shield, Loader2, Heart,
  AlertTriangle, RefreshCw, X
} from "lucide-react";
import { esDonanteActivo } from "@/lib/planes";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useTheme } from "@/components/theme/ThemeProvider";
import { getPerfilUsuario } from "@/lib/firestore";
import { sincronizarCalendar, desconectarCalendar } from "@/lib/calendarCliente";
import { Usuario, ErrorCalendar } from "@/types";

function ConfiguracionContent() {
  const { user } = useAuthContext();
  const { tema, setTema } = useTheme();

  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [calendarConectado, setCalendarConectado] = useState(false);
  const [conectandoCalendar, setConectandoCalendar] = useState(false);
  const [errorCalendar, setErrorCalendar] = useState<string | null>(null);
  const [errorSync, setErrorSync] = useState<ErrorCalendar | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);

  const esDonante = esDonanteActivo(perfil?.suscripcion);

  async function cargarPerfil() {
    if (!user?.uid) return;
    const p = await getPerfilUsuario(user.uid);
    if (!p) return;
    setPerfil(p);
    setCalendarConectado(!!p.credenciales_externas?.google_calendar_refresh_token);
    setErrorSync(p.uso?.calendar_ultimo_error ?? null);
  }

  useEffect(() => {
    cargarPerfil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function reintentarSync() {
    if (!user) return;
    setSincronizando(true);
    try {
      await sincronizarCalendar(user, { reconciliacion: true });
      // Recarga para reflejar si el error se resolvió o sigue.
      await cargarPerfil();
    } finally {
      setSincronizando(false);
    }
  }

  async function darDeBajaCalendar() {
    if (!user) return;
    if (
      !confirm(
        "¿Dar de baja la sincronización con Google Calendar?\n\n" +
          "Los eventos que ya se crearon quedan en tu calendario; podés borrarlos vos si querés."
      )
    ) {
      return;
    }
    setDesconectando(true);
    try {
      const ok = await desconectarCalendar(user);
      if (ok) {
        setCalendarConectado(false);
        setErrorSync(null);
      } else {
        setErrorCalendar("No se pudo dar de baja. Intentá de nuevo.");
      }
    } finally {
      setDesconectando(false);
    }
  }

  // La URL de autorización se arma en el servidor: lleva un `state` firmado que
  // acá no podríamos generar sin exponer el secreto.
  async function conectarCalendar() {
    if (!user) return;
    setConectandoCalendar(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/auth/google-calendar/start", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("No se pudo iniciar la conexión");
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setErrorCalendar("No se pudo conectar con Google Calendar. Intentá de nuevo.");
      setConectandoCalendar(false);
    }
  }

  const inputStyle = {
    background: "var(--background-alt)",
    border: "1.5px solid var(--color-card-border)",
    color: "var(--foreground)",
    outline: "none",
    borderRadius: "var(--radius-md)",
    padding: "0.625rem 0.875rem",
    fontSize: "var(--font-size-sm)",
    width: "100%",
  };

  const temaOpciones = [
    { value: "sistema", label: "Sistema", icon: Monitor },
    { value: "claro", label: "Claro", icon: Sun },
    { value: "oscuro", label: "Oscuro", icon: Moon },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-4 py-6">

        <div className="mb-6">
          <Link href="/" className="text-sm mb-1 block hover:underline"
            style={{ color: "var(--foreground-muted)" }}>← Volver al dashboard</Link>
          <h1 className="text-2xl font-extrabold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
            <Settings size={22} style={{ color: "var(--color-primary)" }} />
            Configuración
          </h1>
        </div>

        <div className="space-y-5">

          {/* Perfil */}
          <div className="rounded-2xl p-5 border" style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
            <h2 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Shield size={16} style={{ color: "var(--color-secondary)" }} />
              Cuenta
            </h2>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl"
                style={{ background: "var(--color-primary)", color: "white" }}>
                {user?.displayName?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div>
                <p className="font-bold" style={{ color: "var(--foreground)" }}>{user?.displayName ?? "Estudiante"}</p>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Apariencia */}
          <div className="rounded-2xl p-5 border" style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
            <h2 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Sun size={16} style={{ color: "var(--color-accent)" }} />
              Apariencia
            </h2>
            <div className="flex gap-3">
              {temaOpciones.map(({ value, label, icon: Icon }) => (
                <button key={value} onClick={() => setTema(value as "sistema" | "claro" | "oscuro")}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border flex flex-col items-center gap-2 transition-all"
                  style={{
                    background: tema === value ? "var(--color-primary)" : "var(--background-alt)",
                    color: tema === value ? "white" : "var(--foreground-muted)",
                    borderColor: tema === value ? "var(--color-primary)" : "var(--color-card-border)",
                  }}>
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Nivel / donación */}
          <div className="rounded-2xl p-5 border" style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
            <h2 className="font-bold text-base mb-1 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Heart size={16} style={{ color: "var(--color-alert)" }} />
              Tu nivel
            </h2>
            {esDonante ? (
              <>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Sos <strong style={{ color: "var(--color-primary)" }}>donante</strong> — gracias por bancar el proyecto.
                  {perfil?.suscripcion?.donante_activo_hasta && (
                    <> Activo hasta el{" "}
                      {new Date(perfil.suscripcion.donante_activo_hasta).toLocaleDateString("es-AR", {
                        day: "numeric", month: "long", year: "numeric",
                      })}.
                    </>
                  )}
                </p>
                <Link href="/donar" className="text-sm font-semibold hover:underline mt-2 inline-block"
                  style={{ color: "var(--color-primary)" }}>
                  Ver detalles
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm mb-3" style={{ color: "var(--foreground-muted)" }}>
                  Estás en el nivel <strong>gratis</strong>: todo ilimitado salvo Google Calendar,
                  que permite una sincronización por mes.
                </p>
                <Link href="/donar"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
                  style={{ background: "var(--color-primary)", color: "white" }}>
                  <Heart size={14} /> Bancá el proyecto
                </Link>
              </>
            )}
          </div>

          {/* Google Calendar */}
          <div className="rounded-2xl p-5 border" style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
            <h2 className="font-bold text-base mb-1 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Calendar size={16} style={{ color: "var(--color-secondary)" }} />
              Google Calendar
            </h2>
            <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
              Tus fechas de parciales y finales se sincronizan solas con tu calendario de Google:
              cuando agregás, editás o borrás una, y con un repaso diario por las dudas. Es gratis
              para todos.
            </p>

            {errorSync && (
              <div className="p-3 rounded-xl mb-3" style={{ background: "var(--estado-libre-bg)" }}>
                <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--color-alert)" }}>
                  <AlertTriangle size={14} />
                  {errorSync.requiere_reconectar
                    ? "Se cortó el permiso con Google"
                    : "La última sincronización falló"}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                  {errorSync.mensaje}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
                  {new Date(errorSync.fecha).toLocaleString("es-AR")}
                </p>
              </div>
            )}

            {calendarConectado ? (
              <div className="space-y-3">
                {!errorSync && (
                  <div className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: "var(--estado-aprobada-bg)", border: "1px solid var(--estado-aprobada)" }}>
                    <Check size={16} style={{ color: "var(--estado-aprobada)" }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--estado-aprobada)" }}>
                      Google Calendar conectado
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={reintentarSync}
                    disabled={sincronizando}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border transition-all hover:opacity-80 disabled:opacity-50"
                    style={{ borderColor: "var(--color-card-border)", color: "var(--foreground)" }}>
                    {sincronizando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {sincronizando ? "Sincronizando..." : "Sincronizar ahora"}
                  </button>

                  {errorSync?.requiere_reconectar && (
                    <button
                      onClick={conectarCalendar}
                      disabled={conectandoCalendar}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ background: "var(--color-primary)", color: "white" }}>
                      {conectandoCalendar ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                      Reconectar
                    </button>
                  )}

                  <button
                    onClick={darDeBajaCalendar}
                    disabled={desconectando}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border transition-all hover:opacity-80 disabled:opacity-50"
                    style={{ borderColor: "var(--color-card-border)", color: "var(--color-alert)" }}>
                    {desconectando ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                    Dar de baja
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  id="btn-conectar-calendar"
                  onClick={conectarCalendar}
                  disabled={conectandoCalendar}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm border transition-all hover:opacity-80 disabled:opacity-50"
                  style={{ background: "var(--background-alt)", borderColor: "var(--color-card-border)", color: "var(--foreground)" }}>
                  {conectandoCalendar
                    ? <Loader2 size={14} className="animate-spin" />
                    : <ExternalLink size={14} />}
                  {conectandoCalendar ? "Redirigiendo..." : "Conectar Google Calendar"}
                </button>
                {errorCalendar && (
                  <p className="text-xs mt-2 font-medium" style={{ color: "var(--color-alert)" }}>
                    {errorCalendar}
                  </p>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default function ConfiguracionPage() {
  return <AuthGuard><ConfiguracionContent /></AuthGuard>;
}
