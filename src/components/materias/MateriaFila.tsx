// src/components/materias/MateriaFila.tsx
// Fila compacta de una materia para listas largas (todas las materias, plan de
// carrera). Toda la fila lleva al detalle.

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { calcularResultadoMateria } from "@/lib/calculo-notas";
import { colorNota, formatearNota, infoEstado } from "@/lib/estados";
import { Materia } from "@/types";

interface MateriaFilaProps {
  materia: Materia;
  /** Texto secundario; por defecto código y año del plan */
  detalle?: React.ReactNode;
  /** Ícono a la izquierda en lugar del punto de color del estado */
  icono?: React.ReactNode;
  atenuada?: boolean;
  /** La lista ya está agrupada por estado: no hace falta repetirlo en cada fila */
  sinEstado?: boolean;
}

export function MateriaFila({ materia, detalle, icono, atenuada, sinEstado }: MateriaFilaProps) {
  const estado = infoEstado(materia.estado);
  const resultado = calcularResultadoMateria(materia);
  const { nota_aprobar, nota_promocionar } = materia.configuracion_nota;

  const porDefecto = [
    materia.codigo_interno,
    materia.año_plan ? `${materia.año_plan}° año` : null,
    materia.periodo_cursado,
  ].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/materias/${materia.id}`}
      className="row-hover flex items-center gap-3 px-4 py-3"
      style={{ opacity: atenuada ? 0.7 : 1 }}
    >
      {icono ?? (sinEstado ? null : (
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: estado.color }}
          aria-hidden
        />
      ))}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-foreground truncate">{materia.nombre}</span>
        {(detalle ?? porDefecto) && (
          <span className="block text-xs text-foreground-subtle truncate">{detalle ?? porDefecto}</span>
        )}
      </span>
      {resultado.nota_proyectada !== null && (
        <span
          className="tabular text-sm font-extrabold flex-shrink-0"
          style={{ color: colorNota(resultado.promedio_actual, nota_aprobar, nota_promocionar) }}
        >
          {formatearNota(resultado.promedio_actual, 1)}
        </span>
      )}
      {!sinEstado && (
        <span className="badge flex-shrink-0" style={{ background: estado.bg, color: estado.color }}>
          {estado.label}
        </span>
      )}
      <ChevronRight size={16} className="text-foreground-subtle flex-shrink-0" />
    </Link>
  );
}
