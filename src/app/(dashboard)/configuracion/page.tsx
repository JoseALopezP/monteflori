"use client";

// src/app/(dashboard)/configuracion/page.tsx
// Configuración completa del usuario

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Settings, Phone, Calendar, Moon, Sun, Monitor,
  Check, ExternalLink, Bell, BellOff, Shield, Loader2, Heart
} from "lucide-react";
import { esDonanteActivo } from "@/lib/planes";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useTheme } from "@/components/theme/ThemeProvider";
import { getPerfilUsuario, updateConfiguracion } from "@/lib/firestore";
import { Usuario } from "@/types";

function ConfiguracionContent() {
  const { user } = useAuthContext();
  const { tema, setTema } = useTheme();

  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [telefono, setTelefono] = useState("");
  const [notifWA, setNotifWA] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [calendarConectado, setCalendarConectado] = useState(false);
  const [conectandoCalendar, setConectandoCalendar] = useState(false);
  const [errorCalendar, setErrorCalendar] = useState<string | null>(null);

  const esDonante = esDonanteActivo(perfil?.suscripcion);

  useEffect(() => {
    if (!user?.uid) return;
    getPerfilUsuario(user.uid).then((p) => {
      if (p) {
        setPerfil(p);
        setTelefono(p.configuracion.telefono_whatsapp ?? "");
        setNotifWA(p.configuracion.notificaciones_whatsapp ?? true);
        setCalendarConectado(!!p.credenciales_externas?.google_calendar_refresh_token);
      }
    });
  }, [user]);

  async function guardarConfiguracion() {
    if (!user?.uid) return;
    setGuardando(true);
    try {
      await updateConfiguracion(user.uid, {
        telefono_whatsapp: telefono.trim() || undefined,
        notificaciones_whatsapp: notifWA,
      });
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 2500);
    } finally {
      setGuardando(false);
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

          {/* WhatsApp */}
          <div className="rounded-2xl p-5 border" style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
            <h2 className="font-bold text-base mb-1 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Phone size={16} style={{ color: "var(--color-success)" }} />
              WhatsApp Bot
            </h2>
            <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
              El bot te enviará recordatorios y podrás hacer consultas sobre tus materias.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                  Tu número de WhatsApp
                </label>
                <input
                  id="config-telefono"
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Ej: 5492641234567 (sin + ni espacios)"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-card-border)")} />
                <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
                  Incluí el código de país. Argentina: 549 + sin el 0 del área
                </p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: "var(--background-alt)" }}>
                <div className="flex items-center gap-3">
                  {notifWA ? <Bell size={16} style={{ color: "var(--color-primary)" }} /> : <BellOff size={16} style={{ color: "var(--foreground-subtle)" }} />}
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Notificaciones proactivas</p>
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Recordatorios de parciales y finales</p>
                  </div>
                </div>
                <button
                  id="toggle-notif-wa"
                  onClick={() => setNotifWA(!notifWA)}
                  className="w-12 h-6 rounded-full transition-all relative"
                  style={{ background: notifWA ? "var(--color-primary)" : "var(--color-card-border)" }}
                  aria-label={notifWA ? "Desactivar notificaciones" : "Activar notificaciones"}
                  role="switch"
                  aria-checked={notifWA}>
                  <span className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                    style={{ left: notifWA ? "calc(100% - 1.25rem)" : "0.25rem" }} />
                </button>
              </div>
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
              Sincronizá automáticamente tus fechas de parciales y finales con tu calendario de Google.
              {!esDonante && " En el nivel gratis podés sincronizar una vez por mes."}
            </p>

            {calendarConectado ? (
              <div className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "var(--estado-aprobada-bg)", border: "1px solid var(--estado-aprobada)" }}>
                <Check size={16} style={{ color: "var(--estado-aprobada)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--estado-aprobada)" }}>
                  Google Calendar conectado
                </span>
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

          {/* Guardar */}
          <button
            id="btn-guardar-config"
            onClick={guardarConfiguracion}
            disabled={guardando}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95 flex items-center justify-center gap-2"
            style={{
              background: guardadoOk ? "var(--color-success)" : "var(--color-primary)",
              color: "white",
              boxShadow: "var(--shadow-md)",
            }}>
            {guardando
              ? <><Loader2 size={16} className="animate-spin" /> Guardando...</>
              : guardadoOk
              ? <><Check size={16} /> ¡Guardado!</>
              : "Guardar configuración"}
          </button>

        </div>
      </div>
    </div>
  );
}

export default function ConfiguracionPage() {
  return <AuthGuard><ConfiguracionContent /></AuthGuard>;
}
