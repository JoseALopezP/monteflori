// src/app/extension/page.tsx
// Página pública (sin auth) con instrucciones para instalar la extensión
// Monteflori Sync en modo desarrollador — Chrome no permite instalar
// extensiones "sueltas" de otra forma fuera de la Chrome Web Store.

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Download, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Instalar Monteflori Sync",
  description: "Extensión de Chrome que trae tus materias y notas desde SIU Guaraní a Monteflori.",
};

const PASOS = [
  {
    titulo: "Descargá el archivo",
    detalle: "Con el botón de arriba. Se baja un .zip a tu carpeta de Descargas.",
  },
  {
    titulo: "Descomprimilo",
    detalle:
      "Click derecho sobre el .zip → “Extraer todo”. Dejá la carpeta en un lugar donde no la vayas a borrar: Chrome la lee siempre desde ahí.",
  },
  {
    titulo: "Abrí la página de extensiones",
    detalle: "Copiá chrome://extensions, pegalo en la barra de direcciones y apretá Enter.",
    codigo: "chrome://extensions",
  },
  {
    titulo: "Activá el “Modo de desarrollador”",
    detalle: "Es un interruptor arriba a la derecha de esa página.",
  },
  {
    titulo: "Cargá la extensión",
    detalle:
      "Tocá “Cargar descomprimida” y elegí la carpeta que descomprimiste (la que tiene adentro el archivo manifest.json).",
  },
];

export default function ExtensionPage() {
  return (
    <main className="page page-narrow !pb-16">
      <Link
        href="/materias/importar"
        className="inline-flex items-center gap-0.5 -ml-1 mb-6 text-sm font-semibold text-foreground-muted hover:text-foreground transition-colors"
      >
        <ChevronLeft size={16} /> Volver a Monteflori
      </Link>

      <div className="flex items-center gap-3 mb-4">
        <Image src="/logo.png" alt="" width={48} height={48} className="rounded-xl" priority />
        <span className="eyebrow">Extensión para Chrome, Edge y Brave</span>
      </div>
      <h1 className="page-title">Instalá Monteflori Sync</h1>
      <p className="text-foreground-muted mt-3 max-w-xl">
        Lee tus materias, notas y correlativas directo desde SIU Guaraní, para que no tengas que cargarlas a
        mano. Vive dentro del navegador: no instala ningún programa en tu computadora.
      </p>

      <a
        href="/downloads/monteflori-sync-extension.zip"
        download
        className="btn btn-primary btn-lg mt-6"
      >
        <Download size={17} /> Descargar la extensión
      </a>

      <h2 className="section-title mt-10 mb-3">Cómo instalarla, paso a paso</h2>
      <ol className="card divide-y divide-card-border overflow-hidden">
        {PASOS.map((paso, i) => (
          <li key={paso.titulo} className="flex gap-4 p-5">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-soft text-primary font-display font-semibold flex items-center justify-center tabular">
              {i + 1}
            </span>
            <div className="min-w-0">
              <h3 className="font-bold text-foreground">{paso.titulo}</h3>
              <p className="text-sm text-foreground-muted mt-0.5">{paso.detalle}</p>
              {paso.codigo && (
                <code className="inline-block mt-2 px-2.5 py-1 rounded-[var(--radius-sm)] bg-background-alt text-sm font-semibold text-foreground select-all">
                  {paso.codigo}
                </code>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="notice mt-4">
        <ShieldCheck size={18} className="flex-shrink-0 mt-0.5 text-primary" />
        <div>
          <p className="font-bold text-foreground">¿Es seguro? ¿Por qué “modo de desarrollador”?</p>
          <p className="mt-1">
            Chrome solo deja instalar extensiones desde su tienda o activando ese modo a mano. Es un paso
            único. La extensión solo funciona en portales universitarios, lee lo que vos ya ves en pantalla y
            nunca conoce tu contraseña de la facultad.
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href="/materias/importar" className="btn btn-secondary">Ya la instalé, seguir</Link>
        <span className="text-sm text-foreground-subtle">Después solo queda sincronizar desde el portal de tu facultad.</span>
      </div>
    </main>
  );
}
