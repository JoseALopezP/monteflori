"use client";

// src/app/(dashboard)/configuracion/page.tsx
// Configuración de la app: apariencia, Google Calendar, SIU Guaraní y apoyo al
// proyecto. Los datos personales están en Mi perfil.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle, CalendarArrowDown, CalendarDays, Check, ChevronRight, ExternalLink, Heart, Monitor, Moon,
  Palette, Puzzle, RefreshCw, Sun, Unplug,
} from "lucide-react";
import { esDonanteActivo } from "@/lib/planes";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useTheme, Tema } from "@/components/theme/ThemeProvider";
import { usePerfil } from "@/hooks/usePerfil";
import { useMaterias } from "@/hooks/useMaterias";
import { useConfirm, useToast } from "@/components/ui/Feedback";
import { PageHeader, Spinner } from "@/components/ui/kit";
import { sincronizarCalendar, desconectarCalendar } from "@/lib/calendarCliente";
import { proximasFechas } from "@/lib/fechas";
import { descargarIcs } from "@/lib/ics";

const TEMAS: { value: Tema; label: string; icon: typeof Sun }[] = [
  { value: "claro", label: "Claro", icon: Sun },
  { value: "oscuro", label: "Oscuro", icon: Moon },
  { value: "sistema", label: "Automático", icon: Monitor },
];

const MENSAJES_CALLBACK: Record<string, { texto: string; tipo: "ok" | "error" }> = {
  ok: { texto: "Google Calendar conectado", tipo: "ok" },
  error: { texto: "No se pudo conectar con Google Calendar. Probá de nuevo.", tipo: "error" },
  sin_token: {
    texto: "Google no nos dio permiso permanente. Volvé a conectar y aceptá todos los permisos.",
    tipo: "error",
  },
};

/** Muestra el resultado al volver de autorizar en Google y limpia la URL. */
function ResultadoConexion() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const resultado = params.get("calendar");

  useEffect(() => {
    if (!resultado) return;
    const mensaje = MENSAJES_CALLBACK[resultado];
    if (mensaje) toast(mensaje.texto, mensaje.tipo);
    // Sin el parámetro, recargar la página no repite el aviso.
    router.replace("/configuracion");
  }, [resultado, toast, router]);

  return null;
}

export default function ConfiguracionPage() {
  const { user } = useAuthContext();
  const { perfil } = usePerfil();
  const { materias } = useMaterias();
  const { tema, setTema } = useTheme();
  const toast = useToast();
  const confirmar = useConfirm();

  const [ocupado, setOcupado] = useState<"conectar" | "sincronizar" | "desconectar" | null>(null);

  // El perfil llega en tiempo real: cuando el servidor termina de sincronizar o
  // registra un error, esta pantalla se actualiza sola.
  const calendarConectado = !!perfil?.credenciales_externas?.google_calendar_refresh_token;
  const errorSync = perfil?.uso?.calendar_ultimo_error ?? null;
  const ultimaSync = perfil?.uso?.ultima_reconciliacion_calendar;
  const esDonante = esDonanteActivo(perfil?.suscripcion);

  // Todas las fechas de hoy en adelante, de todas las carreras.
  const fechas = proximasFechas(materias);

  function descargarFechas() {
    descargarIcs(fechas, "monteflori-fechas.ics");
    toast("Archivo descargado: abrilo para sumarlo a tu calendario");
  }

  // La URL de autorización se arma en el servidor: lleva un `state` firmado que
  // acá no podríamos generar sin exponer el secreto.
  async function conectarCalendar() {
    if (!user) return;
    setOcupado("conectar");
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/auth/google-calendar/start", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      toast("No se pudo iniciar la conexión con Google. Probá de nuevo.", "error");
      setOcupado(null);
    }
  }

  async function sincronizarAhora() {
    if (!user) return;
    setOcupado("sincronizar");
    await sincronizarCalendar(user, { reconciliacion: true });
    setOcupado(null);
    // Si falló, el servidor ya dejó el error en el perfil y aparece arriba.
    toast("Sincronización terminada");
  }

  async function desconectar() {
    if (!user) return;
    const ok = await confirmar({
      titulo: "¿Desconectar Google Calendar?",
      mensaje: "Tus fechas dejan de sincronizarse. Los eventos que ya se crearon quedan en tu calendario.",
      accion: "Desconectar",
    });
    if (!ok) return;
    setOcupado("desconectar");
    const hecho = await desconectarCalendar(user);
    setOcupado(null);
    toast(hecho ? "Google Calendar desconectado" : "No se pudo desconectar. Probá de nuevo.", hecho ? "ok" : "error");
  }

  return (
    <main className="page page-narrow space-y-4">
      <Suspense fallback={null}>
        <ResultadoConexion />
      </Suspense>

      <PageHeader titulo="Configuración" />

      {/* ── Apariencia ── */}
      <section className="card card-pad !mt-0">
        <h2 className="section-title flex items-center gap-2 mb-3">
          <Palette size={17} className="text-accent" /> Apariencia
        </h2>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema de la app">
          {TEMAS.map(({ value, label, icon: Icon }) => {
            const elegido = tema === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={elegido}
                onClick={() => setTema(value)}
                className={`flex flex-col items-center gap-2 py-3.5 rounded-[var(--radius-md)] border-[1.5px] text-sm font-bold transition-colors ${
                  elegido
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-card-border text-foreground-muted hover:border-foreground-subtle hover:text-foreground"
                }`}
              >
                <Icon size={19} />
                {label}
              </button>
            );
          })}
        </div>
        {tema === "sistema" && <p className="hint">Sigue el modo claro u oscuro de tu dispositivo.</p>}
      </section>

      {/* ── Calendario ── */}
      <section className="card card-pad scroll-mt-20" id="calendar">
        <h2 className="section-title flex items-center gap-2">
          <CalendarDays size={17} className="text-secondary" /> Calendario
        </h2>
        <p className="text-sm text-foreground-muted mt-1.5">
          Llevá tus fechas de parciales y finales al calendario que uses, con recordatorio un día antes y una
          hora antes.
        </p>

        {/* Google: se mantiene solo */}
        <div className="mt-5 pt-5 border-t border-card-border">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-bold text-foreground">Google Calendar</h3>
            {calendarConectado && !errorSync && (
              <span className="badge" style={{ background: "var(--color-primary-soft)", color: "var(--color-primary)" }}>
                <Check size={12} strokeWidth={3} /> Conectado
              </span>
            )}
          </div>
          <p className="text-sm text-foreground-muted mt-1">
            Se conecta una vez y se mantiene solo: cada fecha que agregás, cambiás o borrás se actualiza en
            tu calendario.
          </p>

        {errorSync && (
          <div className="notice notice-error mt-3" role="alert">
            <AlertTriangle size={17} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                {errorSync.requiere_reconectar ? "Google cortó el permiso" : "La última sincronización falló"}
              </p>
              <p className="text-xs text-foreground-muted mt-0.5">{errorSync.mensaje}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-3">
          {!calendarConectado ? (
            <button id="btn-conectar-calendar" type="button" className="btn btn-primary" onClick={conectarCalendar} disabled={ocupado !== null}>
              {ocupado === "conectar" ? <Spinner size={14} /> : <ExternalLink size={14} />}
              {ocupado === "conectar" ? "Abriendo Google..." : "Conectar Google Calendar"}
            </button>
          ) : (
            <>
              {errorSync?.requiere_reconectar ? (
                <button type="button" className="btn btn-primary" onClick={conectarCalendar} disabled={ocupado !== null}>
                  {ocupado === "conectar" ? <Spinner size={14} /> : <ExternalLink size={14} />}
                  Volver a conectar
                </button>
              ) : (
                <button type="button" className="btn btn-secondary" onClick={sincronizarAhora} disabled={ocupado !== null}>
                  {ocupado === "sincronizar" ? <Spinner size={14} /> : <RefreshCw size={14} />}
                  {ocupado === "sincronizar" ? "Sincronizando..." : "Sincronizar ahora"}
                </button>
              )}
              <button type="button" className="btn btn-danger-ghost" onClick={desconectar} disabled={ocupado !== null}>
                {ocupado === "desconectar" ? <Spinner size={14} /> : <Unplug size={14} />}
                Desconectar
              </button>
            </>
          )}
        </div>

        {calendarConectado && ultimaSync && !errorSync && (
          <p className="hint">
            Último repaso completo:{" "}
            {new Date(ultimaSync).toLocaleString("es-AR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
        </div>

        {/* Cualquier otro calendario: archivo estándar */}
        <div className="mt-5 pt-5 border-t border-card-border">
          <h3 className="text-sm font-bold text-foreground">Apple, Samsung, Outlook u otro</h3>
          <p className="text-sm text-foreground-muted mt-1">
            Descargás un archivo con tus fechas y, al abrirlo, tu teléfono o tu computadora te ofrece sumarlas
            al calendario. Es una copia: si después cambiás una fecha acá, volvé a descargarlo (las que ya
            tenías se actualizan, no se duplican).
          </p>
          <button type="button" className="btn btn-secondary mt-3" onClick={descargarFechas} disabled={fechas.length === 0}>
            <CalendarArrowDown size={15} />
            {fechas.length === 0
              ? "No tenés fechas próximas"
              : fechas.length === 1
              ? "Descargar mi próxima fecha"
              : `Descargar mis ${fechas.length} próximas fechas`}
          </button>
          <p className="hint">
            También podés llevar una fecha sola desde su materia, con el menú de la fecha.
          </p>
        </div>
      </section>

      {/* ── Accesos ── */}
      <section className="card overflow-hidden divide-y divide-card-border">
        <Link href="/materias/importar" className="row-hover flex items-center gap-3 px-5 py-4">
          <Puzzle size={18} className="text-foreground-muted flex-shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-foreground">SIU Guaraní</span>
            <span className="block text-xs text-foreground-muted">Traer o actualizar tus materias y notas con la extensión</span>
          </span>
          <ChevronRight size={16} className="text-foreground-subtle flex-shrink-0" />
        </Link>
        <Link href="/donar" className="row-hover flex items-center gap-3 px-5 py-4">
          <Heart size={18} className="text-accent flex-shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-foreground">
              {esDonante ? "Estás bancando el proyecto" : "Bancá el proyecto"}
            </span>
            <span className="block text-xs text-foreground-muted">
              {esDonante
                ? "Gracias. Tu aporte mantiene Monteflori en pie."
                : "Monteflori es gratis. Las donaciones pagan el hosting y el dominio."}
            </span>
          </span>
          <ChevronRight size={16} className="text-foreground-subtle flex-shrink-0" />
        </Link>
      </section>
    </main>
  );
}
