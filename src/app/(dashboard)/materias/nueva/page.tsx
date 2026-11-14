"use client";

// src/app/(dashboard)/materias/nueva/page.tsx
// Alta de una materia a mano.

import { PageHeader } from "@/components/ui/kit";
import { MateriaForm } from "@/components/materias/MateriaForm";

export default function NuevaMateriaPage() {
  return (
    <main className="page page-narrow">
      <PageHeader titulo="Nueva materia" volver={{ href: "/materias", label: "Materias" }} />
      <MateriaForm />
    </main>
  );
}
