"use client";

// src/components/ui/Modal.tsx
// Diálogo base de toda la app (Radix Dialog): atrapa el foco, cierra con Esc y
// al tocar afuera, y bloquea el scroll del fondo. En celular sube como hoja
// desde abajo; en escritorio aparece centrado.

import { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

interface ModalProps {
  titulo: string;
  descripcion?: string;
  icono?: ReactNode;
  onCerrar: () => void;
  children: ReactNode;
  /** Botones fijos al pie (no scrollean con el contenido) */
  pie?: ReactNode;
  ancho?: "sm" | "md" | "lg";
}

const ANCHOS = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-2xl" };

export function Modal({ titulo, descripcion, icono, onCerrar, children, pie, ancho = "md" }: ModalProps) {
  return (
    <Dialog.Root open onOpenChange={(abierto) => { if (!abierto) onCerrar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={`dialog-content ${ANCHOS[ancho]}`}
          {...(descripcion ? {} : { "aria-describedby": undefined })}
        >
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 flex-shrink-0">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
                {icono && <span className="text-primary flex-shrink-0">{icono}</span>}
                {titulo}
              </Dialog.Title>
              {descripcion && (
                <Dialog.Description className="text-sm text-foreground-muted mt-1">
                  {descripcion}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="icon-btn -mr-2 -mt-1" aria-label="Cerrar">
              <X size={18} />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>

          {pie && (
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-card-border flex-shrink-0">
              {pie}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
