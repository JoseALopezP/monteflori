"use client";

// src/components/ui/Feedback.tsx
// Dos cosas que toda acción necesita:
//
// - useToast(): confirma en pantalla que algo pasó ("Nota guardada"). Sin esto
//   las acciones eran mudas y había que ir a mirar si habían funcionado.
// - useConfirm(): pregunta antes de borrar, con un diálogo propio en vez del
//   confirm() del navegador. Devuelve una promesa: `if (await confirmar({...}))`.

import {
  createContext, useCallback, useContext, useRef, useState, ReactNode,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";

type TipoToast = "ok" | "error";

interface Toast {
  id: number;
  mensaje: string;
  tipo: TipoToast;
}

interface OpcionesConfirmar {
  titulo: string;
  mensaje?: string;
  /** Texto del botón que confirma. Por defecto "Eliminar". */
  accion?: string;
  /** false para confirmaciones que no destruyen nada */
  peligro?: boolean;
}

interface FeedbackContextValue {
  toast: (mensaje: string, tipo?: TipoToast) => void;
  confirmar: (opciones: OpcionesConfirmar) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue>({
  toast: () => {},
  confirmar: async () => false,
});

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pregunta, setPregunta] = useState<OpcionesConfirmar | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const siguienteId = useRef(1);

  const toast = useCallback((mensaje: string, tipo: TipoToast = "ok") => {
    const id = siguienteId.current++;
    // Como mucho tres a la vez: más que eso tapa la pantalla en el celular.
    setToasts((prev) => [...prev.slice(-2), { id, mensaje, tipo }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      tipo === "error" ? 5500 : 3200
    );
  }, []);

  const confirmar = useCallback((opciones: OpcionesConfirmar) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setPregunta(opciones);
    });
  }, []);

  function responder(ok: boolean) {
    resolver.current?.(ok);
    resolver.current = null;
    setPregunta(null);
  }

  const peligro = pregunta?.peligro ?? true;

  return (
    <FeedbackContext.Provider value={{ toast, confirmar }}>
      {children}

      {/* Toasts: arriba de la barra inferior en celular, abajo a la derecha en escritorio */}
      <div
        className="fixed z-[200] inset-x-0 bottom-24 md:bottom-6 md:left-auto md:right-6 flex flex-col items-center md:items-end gap-2 px-4 pointer-events-none"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-toast-in pointer-events-auto flex items-center gap-2.5 max-w-sm px-4 py-3 rounded-xl text-sm font-semibold shadow-lg"
            style={{
              background: "var(--foreground)",
              color: "var(--background)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {t.tipo === "ok" ? (
              <CheckCircle2 size={17} className="flex-shrink-0" style={{ color: "var(--color-primary-light)" }} />
            ) : (
              <AlertCircle size={17} className="flex-shrink-0" style={{ color: "var(--color-alert-light)" }} />
            )}
            {t.mensaje}
          </div>
        ))}
      </div>

      <Dialog.Root open={!!pregunta} onOpenChange={(abierto) => { if (!abierto) responder(false); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" style={{ zIndex: 150 }} />
          <Dialog.Content
            className="dialog-content sm:max-w-sm"
            style={{ zIndex: 151 }}
            {...(pregunta?.mensaje ? {} : { "aria-describedby": undefined })}
          >
            <div className="p-5">
              <div className="flex items-start gap-3">
                {peligro && (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--estado-libre-bg)" }}
                  >
                    <AlertTriangle size={18} className="text-alert" />
                  </div>
                )}
                <div className="min-w-0 pt-0.5">
                  <Dialog.Title className="font-display text-lg font-semibold text-foreground leading-snug">
                    {pregunta?.titulo}
                  </Dialog.Title>
                  {pregunta?.mensaje && (
                    <Dialog.Description className="text-sm text-foreground-muted mt-1.5">
                      {pregunta.mensaje}
                    </Dialog.Description>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button type="button" className="btn btn-secondary flex-1" onClick={() => responder(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className={`btn flex-1 ${peligro ? "btn-danger" : "btn-primary"}`}
                  onClick={() => responder(true)}
                  autoFocus
                >
                  {pregunta?.accion ?? "Eliminar"}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </FeedbackContext.Provider>
  );
}

export function useToast() {
  return useContext(FeedbackContext).toast;
}

export function useConfirm() {
  return useContext(FeedbackContext).confirmar;
}
