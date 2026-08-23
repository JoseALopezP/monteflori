import { describe, it, expect } from "vitest";
import { esAdmin, obtenerAdminUids } from "./admin";

describe("obtenerAdminUids", () => {
  it("parsea una lista separada por comas", () => {
    expect(obtenerAdminUids("abc,def")).toEqual(["abc", "def"]);
  });

  it("tolera espacios alrededor", () => {
    expect(obtenerAdminUids(" abc , def ")).toEqual(["abc", "def"]);
  });

  it("descarta entradas vacías", () => {
    expect(obtenerAdminUids("abc,,def,")).toEqual(["abc", "def"]);
  });

  it("devuelve vacío si no está configurada", () => {
    expect(obtenerAdminUids(undefined)).toEqual([]);
    expect(obtenerAdminUids("")).toEqual([]);
  });
});

describe("esAdmin", () => {
  it("reconoce a un uid de la lista", () => {
    expect(esAdmin("abc", "abc,def")).toBe(true);
  });

  it("rechaza a quien no está", () => {
    expect(esAdmin("xyz", "abc,def")).toBe(false);
  });

  it("sin lista configurada, nadie es admin", () => {
    // Importante: que la variable falte no puede volver admin a todo el mundo.
    expect(esAdmin("abc", undefined)).toBe(false);
    expect(esAdmin("abc", "")).toBe(false);
  });

  it("un uid vacío nunca es admin", () => {
    expect(esAdmin("", "abc,def")).toBe(false);
    expect(esAdmin("", "")).toBe(false);
  });

  it("exige coincidencia exacta", () => {
    expect(esAdmin("ab", "abc")).toBe(false);
    expect(esAdmin("abcd", "abc")).toBe(false);
  });
});
