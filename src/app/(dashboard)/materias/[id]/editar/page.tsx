"use client";

// src/app/(dashboard)/materias/[id]/editar/page.tsx
// Edición de los datos de una materia ya creada.

import Link from "next/link";
import { useParams } from "next/navigation";
import { SearchX } from "lucide-react";
import { useMaterias } from "@/hooks/useMaterias";
import { EmptyState, Esqueleto, PageHeader } from "@/components/ui/kit";
import { MateriaForm } from "@/components/materias/MateriaForm";

export default function EditarMateriaPage() {
  const { id } = useParams<{ id: string }>();
  const { materias, loading } = useMaterias();
  const materia = materias.find((m) => m.id === id);

  return (
    <main className="page page-narrow">
      <PageHeader
        titulo="Editar materia"
        volver={{ href: materia ? `/materias/${id}` : "/materias", label: materia?.nombre ?? "Materias" }}
      />
      {loading ? (
        <Esqueleto filas={2} alto="h-40" />
      ) : !materia ? (
        <EmptyState icono={<SearchX size={22} />} titulo="No encontramos esta materia" texto="Puede que la hayas eliminado.">
          <Link href="/materias" className="btn btn-primary">Ver mis materias</Link>
        </EmptyState>
      ) : (
        // key: si los datos cambian por debajo, el formulario no se pisa mientras se edita.
        <MateriaForm key={materia.id} materia={materia} />
      )}
    </main>
  );
}
