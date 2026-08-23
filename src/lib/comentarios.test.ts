import { describe, it, expect } from "vitest";
import {
  extraerLinks,
  linkPermitido,
  validarComentario,
  puedeComentar,
  TEXTO_MAX,
  COOLDOWN_MINUTOS,
  MAX_COMENTARIOS_POR_DIA,
} from "./comentarios";

describe("linkPermitido", () => {
  it("acepta dominios de la whitelist", () => {
    expect(linkPermitido("https://drive.google.com/file/d/abc")).toBe(true);
    expect(linkPermitido("https://docs.google.com/document/d/abc")).toBe(true);
  });

  it("acepta subdominios reales", () => {
    expect(linkPermitido("https://es.wikipedia.org/wiki/Algebra")).toBe(true);
  });

  it("ignora el www", () => {
    expect(linkPermitido("https://www.github.com/algo")).toBe(true);
  });

  it("rechaza un dominio que solo CONTIENE uno permitido", () => {
    // El caso que rompe una validación hecha con includes().
    expect(linkPermitido("https://drive.google.com.attacker.net/malo")).toBe(false);
    expect(linkPermitido("https://evildrive.google.com.ru/malo")).toBe(false);
  });

  it("rechaza acortadores y dominios random", () => {
    expect(linkPermitido("https://bit.ly/abc")).toBe(false);
    expect(linkPermitido("https://tinyurl.com/abc")).toBe(false);
    expect(linkPermitido("https://cualquiercosa.com")).toBe(false);
  });

  it("rechaza protocolos que no son http/https", () => {
    expect(linkPermitido("javascript:alert(1)")).toBe(false);
    expect(linkPermitido("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(linkPermitido("file:///etc/passwd")).toBe(false);
  });

  it("rechaza texto que no es una URL", () => {
    expect(linkPermitido("no soy una url")).toBe(false);
    expect(linkPermitido("")).toBe(false);
  });
});

describe("extraerLinks", () => {
  it("encuentra las URLs del texto", () => {
    const links = extraerLinks("Miren esto https://drive.google.com/abc y también http://github.com/x");
    expect(links).toHaveLength(2);
  });

  it("no se come el punto final de la oración", () => {
    expect(extraerLinks("Ver https://github.com/x.")).toEqual(["https://github.com/x"]);
  });

  it("devuelve vacío si no hay links", () => {
    expect(extraerLinks("Un comentario sin links")).toEqual([]);
  });
});

describe("validarComentario", () => {
  it("acepta un comentario normal", () => {
    const r = validarComentario("La cátedra explica muy bien, recomiendo cursarla.");
    expect(r.valido).toBe(true);
  });

  it("rechaza si es muy corto", () => {
    expect(validarComentario("corto").valido).toBe(false);
  });

  it("rechaza si excede el máximo", () => {
    // Es lo que evita que alguien pegue un libro entero.
    expect(validarComentario("a".repeat(TEXTO_MAX + 1)).valido).toBe(false);
  });

  it("rechaza más links de los permitidos", () => {
    const texto =
      "Material: https://drive.google.com/a https://docs.google.com/b https://github.com/c";
    expect(validarComentario(texto).valido).toBe(false);
  });

  it("rechaza si algún link no está permitido", () => {
    const r = validarComentario("Descarguen todo acá https://bit.ly/loquesea gente");
    expect(r.valido).toBe(false);
    expect(r.error).toMatch(/link/i);
  });

  it("devuelve los links extraídos cuando es válido", () => {
    const r = validarComentario("Buen apunte acá: https://drive.google.com/file/d/abc");
    expect(r.valido).toBe(true);
    expect(r.links).toEqual(["https://drive.google.com/file/d/abc"]);
  });
});

describe("puedeComentar", () => {
  const AHORA = new Date("2026-08-15T12:00:00.000Z");

  it("permite si nunca comentó", () => {
    expect(puedeComentar(undefined, AHORA).valido).toBe(true);
  });

  it("bloquea dentro del cooldown", () => {
    const r = puedeComentar({ ultimo_comentario_en: "2026-08-15T11:59:00.000Z" }, AHORA);
    expect(r.valido).toBe(false);
    expect(r.error).toMatch(/esperá/i);
  });

  it("permite pasado el cooldown", () => {
    const hace = new Date(AHORA.getTime() - (COOLDOWN_MINUTOS + 1) * 60_000).toISOString();
    expect(puedeComentar({ ultimo_comentario_en: hace }, AHORA).valido).toBe(true);
  });

  it("bloquea al llegar al tope diario", () => {
    const r = puedeComentar(
      { comentarios_hoy: MAX_COMENTARIOS_POR_DIA, dia_comentarios: "2026-08-15" },
      AHORA
    );
    expect(r.valido).toBe(false);
    expect(r.error).toMatch(/límite/i);
  });

  it("el contador se reinicia al cambiar de día", () => {
    const r = puedeComentar(
      { comentarios_hoy: MAX_COMENTARIOS_POR_DIA, dia_comentarios: "2026-08-14" },
      AHORA
    );
    expect(r.valido).toBe(true);
  });

  it("no se rompe si la fecha guardada está corrupta", () => {
    expect(puedeComentar({ ultimo_comentario_en: "cualquier cosa" }, AHORA).valido).toBe(true);
  });
});
