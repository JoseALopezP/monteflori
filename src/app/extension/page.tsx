// src/app/extension/page.tsx
// Página pública (sin auth) con instrucciones para instalar la extensión
// Monteflori Sync en modo desarrollador — Chrome no permite instalar
// extensiones "sueltas" de otra forma fuera de la Chrome Web Store.

import Link from "next/link";
import {
  Download, Puzzle, ToggleRight, FolderOpen, CheckCircle2, ArrowLeft,
} from "lucide-react";

const PASOS = [
  {
    icono: Download,
    titulo: "Descargá el archivo",
    detalle: "Hacé click en el botón de abajo para bajar el .zip de la extensión.",
  },
  {
    icono: FolderOpen,
    titulo: "Descomprimilo",
    detalle: "Click derecho sobre el .zip descargado → \"Extraer todo\" (o tu descompresor habitual). Guardá la carpeta en un lugar fijo — Chrome la va a leer siempre desde ahí.",
  },
  {
    icono: Puzzle,
    titulo: "Abrí chrome://extensions",
    detalle: "Pegá esa dirección en la barra de Chrome y presioná Enter.",
  },
  {
    icono: ToggleRight,
    titulo: "Activá el \"Modo de desarrollador\"",
    detalle: "Es un interruptor arriba a la derecha de la página.",
  },
  {
    icono: CheckCircle2,
    titulo: "Cargá la extensión",
    detalle: "Click en \"Cargar descomprimida\" y seleccioná la carpeta que descomprimiste (la que tiene el archivo manifest.json adentro).",
  },
];

export default function ExtensionPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/" className="text-sm mb-4 flex items-center gap-1 hover:underline"
          style={{ color: "var(--foreground-muted)" }}>
          <ArrowLeft size={14} /> Volver a Monteflori
        </Link>

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--color-primary)" }}>
            <Puzzle size={30} color="white" />
          </div>
          <h1 className="text-2xl font-extrabold mb-2" style={{ color: "var(--foreground)" }}>
            Instalá Monteflori Sync
          </h1>
          <p className="text-sm max-w-md mx-auto" style={{ color: "var(--foreground-muted)" }}>
            Esta extensión de Chrome lee tus materias y notas directamente desde el portal de tu
            universidad (SIU Guaraní) para que no tengas que cargarlas a mano. No instala ningún
            programa en tu computadora — solo vive dentro del navegador.
          </p>
        </div>

        <div className="text-center mb-8">
          <a
            href="/downloads/monteflori-sync-extension.zip"
            download
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95"
            style={{ background: "var(--color-primary)", color: "white", boxShadow: "var(--shadow-md)" }}
          >
            <Download size={16} /> Descargar extensión (.zip)
          </a>
        </div>

        <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
          {PASOS.map((paso, i) => {
            const Icono = paso.icono;
            return (
              <div key={paso.titulo} className="flex gap-4 p-5"
                style={{ borderBottom: i < PASOS.length - 1 ? "1px solid var(--color-card-border)" : "none" }}>
                <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
                  style={{ background: "var(--background-alt)", color: "var(--color-primary)" }}>
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-2 mb-1" style={{ color: "var(--foreground)" }}>
                    <Icono size={14} style={{ color: "var(--color-secondary)" }} />
                    {paso.titulo}
                  </h3>
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                    {paso.detalle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl p-5 border mt-4 text-sm"
          style={{ background: "var(--background-alt)", borderColor: "var(--color-card-border)", color: "var(--foreground-muted)" }}>
          <strong style={{ color: "var(--foreground)" }}>¿Por qué modo desarrollador?</strong> Chrome
          no permite instalar extensiones sueltas por seguridad — solo desde la Chrome Web Store o
          activando este modo manualmente. Es un paso único; después la extensión queda instalada
          igual que cualquier otra.
        </div>
      </div>
    </div>
  );
}
