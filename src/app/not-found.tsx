// src/app/not-found.tsx
// 404 con la identidad visual de la app, en vez del fallback genérico de Next.

import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <main className="flex-1 min-h-screen flex items-center justify-center p-6 text-center">
      <div className="flex flex-col items-center max-w-sm">
        <Image src="/logo.png" alt="" width={56} height={56} className="rounded-2xl" />
        <p className="font-display tabular text-7xl font-semibold text-primary mt-5 leading-none">404</p>
        <h1 className="font-display text-2xl font-semibold text-foreground mt-3">Acá no hay nada</h1>
        <p className="text-sm text-foreground-muted mt-2">
          Puede que el link esté mal escrito o que la página ya no exista.
        </p>
        <Link href="/" className="btn btn-primary mt-6">Volver al inicio</Link>
      </div>
    </main>
  );
}
