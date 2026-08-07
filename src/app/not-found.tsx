// src/app/not-found.tsx
// 404 con la identidad visual de la app, en vez del fallback genérico de Next.

import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <main
      className="min-h-screen w-full flex items-center justify-center p-6 text-center"
      style={{ background: "var(--background)" }}
    >
      <div className="flex flex-col items-center gap-4 max-w-sm">
        <Image src="/logo.png" alt="Monteflori" width={64} height={64} className="rounded-2xl" />
        <div>
          <p className="text-5xl font-extrabold" style={{ color: "var(--color-primary)" }}>
            404
          </p>
          <h1 className="text-xl font-bold mt-2" style={{ color: "var(--foreground)" }}>
            No encontramos esta página
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "var(--foreground-muted)" }}>
            Puede que el link esté mal escrito o que la página ya no exista.
          </p>
        </div>
        <Link
          href="/"
          className="mt-1 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
          style={{ background: "var(--color-primary)", color: "white" }}
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
