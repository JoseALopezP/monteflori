"use client";

// src/app/(dashboard)/donar/page.tsx
// Explica qué se banca con una donación y arranca el flujo por Mercado Pago.
//
// Monteflori no tiene funciones pagas: donar no desbloquea nada. Es apoyo al
// proyecto, no una suscripción con beneficios, y la pantalla lo dice claro.

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Heart, Sparkles } from "lucide-react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { usePerfil } from "@/hooks/usePerfil";
import { PageHeader, Spinner } from "@/components/ui/kit";
import { DONACION_MINIMA_ARS, esDonanteActivo } from "@/lib/planes";

const LO_QUE_HACE = [
  "Materias, notas y fórmula de cálculo a tu medida",
  "Sincronización con SIU Guaraní desde la extensión",
  "Plan de carrera, correlativas y gráficos",
  "Fechas de parciales y finales en tu Google Calendar",
];

const MONTOS = [DONACION_MINIMA_ARS, DONACION_MINIMA_ARS * 2, DONACION_MINIMA_ARS * 4];
const pesos = (n: number) => `$${n.toLocaleString("es-AR")}`;

function AvisoVolviendo({ yaEsDonante }: { yaEsDonante: boolean }) {
  const volviendo = useSearchParams().get("estado") === "volviendo";
  if (!volviendo || yaEsDonante) return null;
  return (
    <div className="notice notice-warn">
      Estamos esperando la confirmación de Mercado Pago. Puede tardar unos minutos en verse acá: no hace
      falta que dones de nuevo.
    </div>
  );
}

export default function DonarPage() {
  const { user } = useAuthContext();
  const { perfil, loading } = usePerfil();

  const [monto, setMonto] = useState<number>(DONACION_MINIMA_ARS);
  const [otro, setOtro] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yaEsDonante = esDonanteActivo(perfil?.suscripcion);
  const hasta = perfil?.suscripcion?.donante_activo_hasta;
  const montoValido = Number.isFinite(monto) && monto >= DONACION_MINIMA_ARS;

  async function handleDonar() {
    if (!user || !montoValido) return;
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
      if (!res.ok) throw new Error(datos.error ?? "No se pudo iniciar la donación.");
      window.location.href = datos.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar la donación.");
      setProcesando(false);
    }
  }

  return (
    <main className="page page-narrow space-y-4">
      <PageHeader
        titulo="Bancá Monteflori"
        subtitulo="Monteflori es gratis y lo va a seguir siendo. Donar no desbloquea nada: todo está disponible para todos. Las donaciones pagan lo que cuesta tenerlo en pie, el hosting y el dominio."
      />

      <Suspense fallback={null}>
        <AvisoVolviendo yaEsDonante={yaEsDonante} />
      </Suspense>

      {!loading && yaEsDonante && (
        <div className="notice notice-success items-center !mt-0">
          <Sparkles size={18} className="flex-shrink-0" />
          <div>
            <p className="font-bold">Estás bancando el proyecto. ¡Gracias!</p>
            <p className="text-xs mt-0.5">
              {hasta && (
                <>Tu aporte está vigente hasta el{" "}
                  {new Date(hasta).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}.{" "}
                </>
              )}
              Podés cancelarlo cuando quieras desde Mercado Pago.
            </p>
          </div>
        </div>
      )}

      {!loading && !yaEsDonante && (
        <section className="card card-pad !mt-0">
          <h2 className="section-title" id="monto-label">¿Con cuánto querés ayudar por mes?</h2>
          <div className="grid grid-cols-3 gap-2 mt-3" role="radiogroup" aria-labelledby="monto-label">
            {MONTOS.map((m) => {
              const elegido = otro === "" && monto === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={elegido}
                  onClick={() => { setMonto(m); setOtro(""); }}
                  className={`py-3.5 rounded-[var(--radius-md)] border-[1.5px] font-display tabular text-xl font-semibold transition-colors ${
                    elegido
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-card-border text-foreground hover:border-foreground-subtle"
                  }`}
                >
                  {pesos(m)}
                </button>
              );
            })}
          </div>

          <div className="mt-3">
            <label className="label" htmlFor="monto-otro">O elegí otro monto</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-subtle font-bold pointer-events-none">$</span>
              <input
                id="monto-otro"
                className="input no-spin tabular !pl-8"
                type="number"
                inputMode="numeric"
                min={DONACION_MINIMA_ARS}
                value={otro}
                onChange={(e) => { setOtro(e.target.value); setMonto(Number(e.target.value)); }}
                placeholder={`${DONACION_MINIMA_ARS.toLocaleString("es-AR")} o más`}
                aria-invalid={otro !== "" && !montoValido}
              />
            </div>
            {otro !== "" && !montoValido && (
              <p className="text-xs font-semibold text-alert mt-1.5">El mínimo es {pesos(DONACION_MINIMA_ARS)}.</p>
            )}
          </div>

          {error && <div className="notice notice-error mt-4" role="alert">{error}</div>}

          <button type="button" onClick={handleDonar} disabled={procesando || !montoValido} className="btn btn-primary btn-lg btn-block mt-5">
            {procesando ? <Spinner /> : <Heart size={16} />}
            {procesando
              ? "Abriendo Mercado Pago..."
              : montoValido
              ? `Donar ${pesos(monto)} por mes`
              : "Donar con Mercado Pago"}
          </button>
          <p className="hint text-center">
            Es un aporte mensual por Mercado Pago. Lo cancelás cuando quieras desde ahí, sin pedirnos nada.
          </p>
        </section>
      )}

      <section className="card card-pad">
        <h2 className="section-title mb-3">Lo que estás bancando</h2>
        <ul className="space-y-2.5">
          {LO_QUE_HACE.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-foreground-muted">
              <Check size={16} strokeWidth={3} className="mt-0.5 flex-shrink-0 text-primary" />
              {b}
            </li>
          ))}
        </ul>
        <p className="hint !mt-4 pt-3 border-t border-card-border">Todo esto es gratis para cualquiera, dones o no.</p>
      </section>
    </main>
  );
}
