import { describe, it, expect, beforeEach } from "vitest";
import { verificarRateLimit, resetRateLimit } from "./rate-limit";

const VENTANA = 60_000;

beforeEach(() => {
  resetRateLimit();
});

describe("verificarRateLimit", () => {
  it("permite los pedidos dentro del límite", () => {
    const t = 1_000_000;
    expect(verificarRateLimit("a", 3, VENTANA, t).permitido).toBe(true);
    expect(verificarRateLimit("a", 3, VENTANA, t).permitido).toBe(true);
    expect(verificarRateLimit("a", 3, VENTANA, t).permitido).toBe(true);
  });

  it("bloquea al superar el límite dentro de la misma ventana", () => {
    const t = 1_000_000;
    verificarRateLimit("a", 2, VENTANA, t);
    verificarRateLimit("a", 2, VENTANA, t);
    const r = verificarRateLimit("a", 2, VENTANA, t);
    expect(r.permitido).toBe(false);
    expect(r.reintentarEn).toBeGreaterThan(0);
  });

  it("vuelve a permitir cuando la ventana vence", () => {
    const t = 1_000_000;
    verificarRateLimit("a", 1, VENTANA, t);
    expect(verificarRateLimit("a", 1, VENTANA, t).permitido).toBe(false);
    expect(verificarRateLimit("a", 1, VENTANA, t + VENTANA + 1).permitido).toBe(true);
  });

  it("lleva la cuenta por separado para cada clave", () => {
    const t = 1_000_000;
    verificarRateLimit("usuario-1", 1, VENTANA, t);
    // Que un usuario agote su cupo no puede afectar a otro.
    expect(verificarRateLimit("usuario-1", 1, VENTANA, t).permitido).toBe(false);
    expect(verificarRateLimit("usuario-2", 1, VENTANA, t).permitido).toBe(true);
  });

  it("informa cuántos segundos faltan para reintentar", () => {
    const t = 1_000_000;
    verificarRateLimit("a", 1, VENTANA, t);
    const r = verificarRateLimit("a", 1, VENTANA, t + 20_000);
    expect(r.permitido).toBe(false);
    expect(r.reintentarEn).toBe(40); // 60s de ventana - 20s transcurridos
  });
});
