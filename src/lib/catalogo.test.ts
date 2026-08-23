import { describe, it, expect } from "vitest";
import {
  normalizarTexto,
  institucionIdDesdeHostname,
  claveDeDedup,
  esLaMismaMateria,
  rangoBusquedaPrefijo,
} from "./catalogo";

describe("normalizarTexto", () => {
  it("saca acentos, mayúsculas y espacios de más", () => {
    expect(normalizarTexto("  Análisis   MATEMÁTICO  I ")).toBe("analisis matematico i");
  });

  it("tolera vacío", () => {
    expect(normalizarTexto("")).toBe("");
  });
});

describe("institucionIdDesdeHostname", () => {
  it("extrae la institución de un portal SIU", () => {
    expect(institucionIdDesdeHostname("autogestion.guarani.unsj.edu.ar")).toBe("unsj");
  });

  it("agrupa distintos portales de la misma universidad", () => {
    // Que dos portales de la misma facultad caigan en la misma clave es lo que
    // permite que compartan catálogo y comentarios.
    expect(institucionIdDesdeHostname("autogestion.guarani.unsj.edu.ar")).toBe(
      institucionIdDesdeHostname("aulas.unsj.edu.ar")
    );
  });

  it("funciona con UADE y Siglo 21", () => {
    expect(institucionIdDesdeHostname("estudiantes.uade.edu.ar")).toBe("uade");
    expect(institucionIdDesdeHostname("lanube.21.edu.ar")).toBe("21");
  });

  it("ignora el puerto", () => {
    expect(institucionIdDesdeHostname("autogestion.unsj.edu.ar:443")).toBe("unsj");
  });

  it("no distingue mayúsculas", () => {
    expect(institucionIdDesdeHostname("Autogestion.UNSJ.edu.ar")).toBe("unsj");
  });

  it("devuelve vacío para un hostname vacío", () => {
    expect(institucionIdDesdeHostname("")).toBe("");
  });
});

describe("claveDeDedup", () => {
  it("usa el código cuando existe", () => {
    expect(claveDeDedup("unsj", "F12400", "Adquisición de Lenguas")).toBe("unsj::cod::f12400");
  });

  it("la misma materia en dos carreras da la misma clave", () => {
    // Es el caso que hace que compartan comentarios entre carreras.
    const enLicenciatura = claveDeDedup("unsj", "F12400", "Adquisición de Lenguas");
    const enProfesorado = claveDeDedup("unsj", "F12400", "Adquisicion de Lenguas");
    expect(enLicenciatura).toBe(enProfesorado);
  });

  it("cae al nombre cuando no hay código", () => {
    expect(claveDeDedup("unsj", null, "Álgebra Lineal")).toBe("unsj::nom::algebra lineal");
  });

  it("separa instituciones distintas con el mismo código", () => {
    expect(claveDeDedup("unsj", "F12400", "X")).not.toBe(claveDeDedup("uade", "F12400", "X"));
  });

  it("no confunde una materia con código con otra sin código", () => {
    expect(claveDeDedup("unsj", "A1", "Algebra")).not.toBe(claveDeDedup("unsj", null, "Algebra"));
  });
});

describe("esLaMismaMateria", () => {
  const base = { institucion_id: "unsj", codigo: "F12400", nombre_normalizado: "algebra" };

  it("son la misma si coincide institución y código", () => {
    expect(esLaMismaMateria(base, { ...base, nombre_normalizado: "otro nombre" })).toBe(true);
  });

  it("no son la misma si difiere la institución", () => {
    expect(esLaMismaMateria(base, { ...base, institucion_id: "uade" })).toBe(false);
  });

  it("con ambos códigos presentes, manda el código sobre el nombre", () => {
    expect(esLaMismaMateria(base, { ...base, codigo: "F99999" })).toBe(false);
  });

  it("si falta algún código, compara por nombre", () => {
    const sinCodigo = { institucion_id: "unsj", codigo: null, nombre_normalizado: "algebra" };
    expect(esLaMismaMateria(sinCodigo, { ...sinCodigo })).toBe(true);
    expect(esLaMismaMateria(base, sinCodigo)).toBe(true);
  });
});

describe("rangoBusquedaPrefijo", () => {
  it("arma un rango que cubre todo lo que empiece con la consulta", () => {
    const { desde, hasta } = rangoBusquedaPrefijo("Alge");
    expect(desde).toBe("alge");
    expect(hasta.startsWith("alge")).toBe(true);
    expect(hasta > desde).toBe(true);
  });
});
