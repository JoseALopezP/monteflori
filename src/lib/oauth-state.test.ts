import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { crearState, verificarState } from "./oauth-state";

const SECRET_ORIGINAL = process.env.OAUTH_STATE_SECRET;

beforeEach(() => {
  process.env.OAUTH_STATE_SECRET = "secreto-de-prueba";
});

afterEach(() => {
  process.env.OAUTH_STATE_SECRET = SECRET_ORIGINAL;
  vi.useRealTimers();
});

describe("crearState / verificarState", () => {
  it("acepta un state recién emitido y recupera el uid", () => {
    expect(verificarState(crearState("usuario-123"))).toBe("usuario-123");
  });

  it("rechaza un state con la firma alterada", () => {
    const state = crearState("usuario-123");
    const [payload] = state.split(".");
    expect(verificarState(`${payload}.firmaInventada`)).toBeNull();
  });

  it("rechaza un state cuyo payload fue modificado para suplantar a otro usuario", () => {
    const [, firma] = crearState("usuario-123").split(".");
    const payloadFalso = Buffer.from(`victima.${Date.now()}`).toString("base64url");
    expect(verificarState(`${payloadFalso}.${firma}`)).toBeNull();
  });

  it("rechaza un state firmado con otro secreto", () => {
    const state = crearState("usuario-123");
    process.env.OAUTH_STATE_SECRET = "otro-secreto-distinto";
    expect(verificarState(state)).toBeNull();
  });

  it("rechaza un state vencido", () => {
    vi.useFakeTimers();
    const state = crearState("usuario-123");
    vi.advanceTimersByTime(11 * 60 * 1000); // la ventana es de 10 minutos
    expect(verificarState(state)).toBeNull();
  });

  it("sigue aceptando un state dentro de la ventana de validez", () => {
    vi.useFakeTimers();
    const state = crearState("usuario-123");
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(verificarState(state)).toBe("usuario-123");
  });

  it("rechaza entradas vacías o mal formadas", () => {
    expect(verificarState(null)).toBeNull();
    expect(verificarState("")).toBeNull();
    expect(verificarState("sinpunto")).toBeNull();
    expect(verificarState("...")).toBeNull();
  });

  it("preserva uids que contienen puntos", () => {
    // El payload separa uid y timestamp por el ÚLTIMO punto, no el primero.
    const uid = "auth0|us.er.123";
    expect(verificarState(crearState(uid))).toBe(uid);
  });

  it("falla ruidosamente si no hay secreto configurado en vez de firmar con algo vacío", () => {
    delete process.env.OAUTH_STATE_SECRET;
    expect(() => crearState("usuario-123")).toThrow(/OAUTH_STATE_SECRET/);
  });
});
