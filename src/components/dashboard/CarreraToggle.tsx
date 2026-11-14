"use client";

// src/components/dashboard/CarreraToggle.tsx
// Selector de qué carrera se está mirando. Todo el dashboard (inicio, materias,
// plan, gráficos) se filtra por lo que se elija acá.

import Link from "next/link";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, GraduationCap, Layers, Settings2 } from "lucide-react";
import { useCarreraActivaContext } from "./CarreraActivaProvider";

export function CarreraToggle() {
  const { carreras, carreraActiva, carreraActivaId, setCarreraActivaId } = useCarreraActivaContext();

  if (carreras.length === 0) return null;

  return (
    <Dropdown.Root>
      <Dropdown.Trigger
        id="btn-toggle-carrera"
        className="btn btn-secondary max-w-full min-w-0 !font-semibold"
        aria-label={`Carrera: ${carreraActiva?.nombre ?? "todas"}. Cambiar`}
      >
        {carreraActiva ? (
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: carreraActiva.color ?? "var(--color-primary)" }}
          />
        ) : (
          <Layers size={15} className="text-foreground-muted flex-shrink-0" />
        )}
        <span className="truncate">{carreraActiva?.nombre ?? "Todas las carreras"}</span>
        <ChevronDown size={14} className="text-foreground-subtle flex-shrink-0" />
      </Dropdown.Trigger>

      <Dropdown.Portal>
        <Dropdown.Content className="menu w-72 max-w-[calc(100vw-2rem)]" align="center" sideOffset={8}>
          <Dropdown.Label className="menu-label">Estás viendo</Dropdown.Label>

          {carreras.length > 1 && (
            <Dropdown.Item className="menu-item" onSelect={() => setCarreraActivaId(null)}>
              <Layers size={15} className="text-foreground-muted flex-shrink-0" />
              <span className="flex-1">Todas las carreras</span>
              {carreraActivaId === null && <Check size={15} className="text-primary" />}
            </Dropdown.Item>
          )}

          {carreras.map((c) => (
            <Dropdown.Item key={c.id} className="menu-item" onSelect={() => setCarreraActivaId(c.id)}>
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 mx-[3px]"
                style={{ background: c.color ?? "var(--color-primary)" }}
              />
              <span className="flex-1 min-w-0">
                <span className="block truncate">{c.nombre}</span>
                {c.institucion && (
                  <span className="block text-xs font-medium text-foreground-subtle truncate">
                    {c.institucion}
                  </span>
                )}
              </span>
              {carreraActivaId === c.id && <Check size={15} className="text-primary flex-shrink-0" />}
            </Dropdown.Item>
          ))}

          {carreras.length === 1 && carreraActivaId !== null && (
            <Dropdown.Item className="menu-item" onSelect={() => setCarreraActivaId(null)}>
              <GraduationCap size={15} className="text-foreground-muted flex-shrink-0" />
              <span className="flex-1">Ver también materias sin carrera</span>
            </Dropdown.Item>
          )}

          <div className="menu-sep" />
          <Dropdown.Item className="menu-item" asChild>
            <Link href="/carreras">
              <Settings2 size={15} className="text-foreground-muted flex-shrink-0" />
              Administrar carreras
            </Link>
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
