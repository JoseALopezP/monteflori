"use client";

// src/app/(dashboard)/donar/page.tsx
// Explica los dos niveles y arranca el flujo de donación por Mercado Pago.

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Heart, Check, Loader2, Sparkles } from "lucide-react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { usePerfil } from "@/hooks/usePerfil";
import { DONACION_MINIMA_ARS, esDonanteActivo } from "@/lib/planes";

const BENEFICIOS_GRATIS = [
  "Materias, notas y fórmula de cálculo — sin límite",
  "Extensión de SIU Guaraní — sincronizaciones ilimitadas",
  "Plan de ruta, correlativas y gráficos",
  "Google Calendar: 1 sincronización por mes",
];

const BENEFICIOS_DONANTE = [
  "Todo lo del nivel gratis",
  "Google Calendar: sincronizaciones ilimitadas",
  "Bot de WhatsApp (cuando se habilite)",
  "Bancás los costos de servidor y de las APIs",
];

export default function DonarPage() {
  const { user } = useAuthContext();
  const { perfil, loading } = usePerfil(user?.uid ?? null);
  const searchParams = useSearchParams();

  const [monto, setMonto] = useState<number>(DONACION_MINIMA_ARS);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yaEsDonante = esDonanteActivo(perfil?.suscripcion);
  const volviendoDePago = searchParams.get("estado") === "volviendo";

  async function handleDonar() {
    if (!user) return;
    setError(null);
    setProcesando(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/mercadopago/crear-suscripcion", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ monto }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? "Error");
      window.location.href = datos.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar la donación.");
      setProcesando(false);
    }
  }

  const cardStyle = {
    background: "var(--color-card)",
    borderColor: "var(--color-card-border)",
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
            <Heart size={22} style={{ color: "var(--color-alert)" }} />
            Bancá Monteflori
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
            Monteflori es gratis y lo va a seguir siendo. Las donaciones cubren los costos
            de servidor y de las APIs que usa (como Google Calendar), que se pagan por uso.
          </p>
        </div>

        {volviendoDePago && !yaEsDonante && (
          <div className="p-3.5 rounded-xl text-sm"
            style={{ background: "var(--estado-cursando-bg)", color: "var(--estado-cursando)" }}>
            Estamos esperando la confirmación de Mercado Pago. Puede tardar unos minutos
            en verse reflejado — no hace falta que dones de nuevo.
          </div>
        )}

        {!loading && yaEsDonante && (
          <div className="p-4 rounded-2xl border flex items-center gap-3"
            style={{ background: "var(--estado-aprobada-bg)", borderColor: "var(--estado-aprobada)" }}>
            <Sparkles size={18} style={{ color: "var(--estado-aprobada)" }} />
            <div>
              <p className="font-bold text-sm" style={{ color: "var(--estado-aprobada)" }}>
                Ya sos donante — ¡gracias!
              </p>
              {perfil?.suscripcion?.donante_activo_hasta && (
                <p className="text-xs mt-0.5" style={{ color: "var(--estado-aprobada)" }}>
                  Tu nivel está activo hasta el{" "}
                  {new Date(perfil.suscripcion.donante_activo_hasta).toLocaleDateString("es-AR", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                  . Podés cancelar cuando quieras desde Mercado Pago.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl p-5 border" style={cardStyle}>
            <h2 className="font-bold text-base" style={{ color: "var(--foreground)" }}>Gratis</h2>
            <p className="text-2xl font-extrabold mt-1 mb-4" style={{ color: "var(--foreground)" }}>
              $0
            </p>
            <ul className="space-y-2">
              {BENEFICIOS_GRATIS.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
                  <Check size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--color-primary)" }} />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl p-5 border-2" style={{ ...cardStyle, borderColor: "var(--color-primary)" }}>
            <h2 className="font-bold text-base flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Heart size={15} style={{ color: "var(--color-alert)" }} /> Donante
            </h2>
            <p className="text-2xl font-extrabold mt-1" style={{ color: "var(--color-primary)" }}>
              desde ${DONACION_MINIMA_ARS.toLocaleString("es-AR")}
              <span className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}> /mes</span>
            </p>
            <p className="text-xs mb-4 mt-0.5" style={{ color: "var(--foreground-subtle)" }}>
              Podés cancelar cuando quieras
            </p>
            <ul className="space-y-2">
              {BENEFICIOS_DONANTE.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
                  <Check size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--color-primary)" }} />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {!yaEsDonante && (
          <div className="rounded-2xl p-5 border space-y-3" style={cardStyle}>
            <label className="block text-sm font-semibold" style={{ color: "var(--foreground-muted)" }}>
              ¿Cuánto querés donar por mes?
            </label>
            <div className="flex flex-wrap gap-2">
              {[DONACION_MINIMA_ARS, DONACION_MINIMA_ARS * 2, DONACION_MINIMA_ARS * 4].map((m) => (
                <button key={m} onClick={() => setMonto(m)}
                  className="px-4 py-2 rounded-xl text-sm font-bold border transition-all"
                  style={{
                    background: monto === m ? "var(--color-primary)" : "var(--background-alt)",
                    color: monto === m ? "white" : "var(--foreground-muted)",
                    borderColor: monto === m ? "var(--color-primary)" : "var(--color-card-border)",
                  }}>
                  ${m.toLocaleString("es-AR")}
                </button>
              ))}
              <input
                type="number"
                min={DONACION_MINIMA_ARS}
                value={monto}
                onChange={(e) => setMonto(Number(e.target.value))}
                className="w-32 px-3 py-2 rounded-xl text-sm font-bold"
                style={{
                  background: "var(--background-alt)",
                  border: "1.5px solid var(--color-card-border)",
                  color: "var(--foreground)",
                  outline: "none",
                }}
                aria-label="Otro monto"
              />
            </div>

            {error && (
              <p className="text-sm font-medium" style={{ color: "var(--color-alert)" }}>{error}</p>
            )}

            <button
              onClick={handleDonar}
              disabled={procesando || monto < DONACION_MINIMA_ARS}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: "var(--color-primary)", color: "white" }}
            >
              {procesando ? <Loader2 size={16} className="animate-spin" /> : <Heart size={16} />}
              {procesando ? "Redirigiendo a Mercado Pago..." : "Donar con Mercado Pago"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
