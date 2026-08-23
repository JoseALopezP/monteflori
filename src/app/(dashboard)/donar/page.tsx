"use client";

// src/app/(dashboard)/donar/page.tsx
// Explica los dos niveles y arranca el flujo de donación por Mercado Pago.

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Heart, Check, Loader2, Sparkles } from "lucide-react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { usePerfil } from "@/hooks/usePerfil";
import { DONACION_MINIMA_ARS, esDonanteActivo } from "@/lib/planes";

// Monteflori no tiene funciones pagas: donar no desbloquea nada. Es apoyo al
// proyecto, no una suscripción. Lo que se lista es lo que la app hace para
// todos, para que quede claro qué se está bancando.
const LO_QUE_HACE = [
  "Materias, notas y constructor de fórmula de cálculo",
  "Sincronización con SIU Guaraní desde la extensión",
  "Plan de ruta, correlativas y gráficos",
  "Fechas de parciales y finales en tu Google Calendar",
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
            Monteflori es gratis y lo va a seguir siendo. <strong>Donar no desbloquea
            funciones</strong>: todo lo que hace la app está disponible para todos. Las
            donaciones bancan lo que cuesta tenerla en pie — el dominio y el hosting.
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
                Estás bancando el proyecto — ¡gracias!
              </p>
              {perfil?.suscripcion?.donante_activo_hasta && (
                <p className="text-xs mt-0.5" style={{ color: "var(--estado-aprobada)" }}>
                  Tu aporte está vigente hasta el{" "}
                  {new Date(perfil.suscripcion.donante_activo_hasta).toLocaleDateString("es-AR", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                  . Podés cancelar cuando quieras desde Mercado Pago.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="rounded-2xl p-5 border" style={cardStyle}>
          <h2 className="font-bold text-base mb-3" style={{ color: "var(--foreground)" }}>
            Lo que estás bancando
          </h2>
          <ul className="space-y-2">
            {LO_QUE_HACE.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
                <Check size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--color-primary)" }} />
                {b}
              </li>
            ))}
          </ul>
          <p className="text-xs mt-4 pt-3 border-t" style={{ color: "var(--foreground-subtle)", borderColor: "var(--color-card-border)" }}>
            Todo esto es gratis para cualquiera, dones o no. Podés cancelar cuando quieras
            desde Mercado Pago.
          </p>
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
