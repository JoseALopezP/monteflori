import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildGrafo,
  getMateriasHabilitadas,
  getMateriasBloqueadas,
  ordenTopologico,
} from "./grafo-correlativas";
import { Materia, EstadoMateria } from "@/types";

function materia(
  id: string,
  estado: EstadoMateria = "pendiente",
  correlativas: string[] = []
): Materia {
  return {
    id,
    nombre: `Materia ${id}`,
    estado,
    configuracion_nota: { sistema: "lineal", nota_aprobar: 4, nota_promocionar: 7 },
    evaluaciones: [],
    correlativas_requisito: correlativas,
    ultima_actualizacion: new Date().toISOString(),
  };
}

describe("buildGrafo", () => {
  it("marca como habilitada una materia sin correlativas", () => {
    const grafo = buildGrafo([materia("a")]);
    expect(grafo[0].habilitada).toBe(true);
    expect(grafo[0].bloqueada_por).toEqual([]);
  });

  it("habilita una materia cuando su correlativa está aprobada", () => {
    const grafo = buildGrafo([materia("a", "aprobada"), materia("b", "pendiente", ["a"])]);
    const b = grafo.find((n) => n.id === "b")!;
    expect(b.habilitada).toBe(true);
    expect(b.bloqueada_por).toEqual([]);
  });

  it("bloquea una materia cuando su correlativa sigue pendiente", () => {
    const grafo = buildGrafo([materia("a", "pendiente"), materia("b", "pendiente", ["a"])]);
    const b = grafo.find((n) => n.id === "b")!;
    expect(b.habilitada).toBe(false);
    expect(b.bloqueada_por).toEqual(["a"]);
  });

  it("cuenta 'regular' como suficiente para habilitar la siguiente materia", () => {
    const grafo = buildGrafo([materia("a", "regular"), materia("b", "pendiente", ["a"])]);
    expect(grafo.find((n) => n.id === "b")!.habilitada).toBe(true);
  });

  it("no habilita si la correlativa está en curso (todavía no se aprobó)", () => {
    const grafo = buildGrafo([materia("a", "cursando"), materia("b", "pendiente", ["a"])]);
    const b = grafo.find((n) => n.id === "b")!;
    expect(b.habilitada).toBe(false);
    expect(b.bloqueada_por).toEqual(["a"]);
  });

  it("ignora correlativas que apuntan a materias inexistentes en vez de bloquear para siempre", () => {
    // Puede pasar al importar de SIU Guaraní si una correlativa no se importó.
    const grafo = buildGrafo([materia("b", "pendiente", ["fantasma"])]);
    expect(grafo[0].habilitada).toBe(true);
    expect(grafo[0].bloqueada_por).toEqual([]);
  });

  it("lista en habilita_a las materias que dependen de esta", () => {
    const grafo = buildGrafo([
      materia("a", "aprobada"),
      materia("b", "pendiente", ["a"]),
      materia("c", "pendiente", ["a"]),
    ]);
    expect(grafo.find((n) => n.id === "a")!.habilita_a.sort()).toEqual(["b", "c"]);
  });

  it("acumula todas las correlativas faltantes, no solo la primera", () => {
    const grafo = buildGrafo([
      materia("a", "pendiente"),
      materia("b", "pendiente"),
      materia("c", "pendiente", ["a", "b"]),
    ]);
    expect(grafo.find((n) => n.id === "c")!.bloqueada_por.sort()).toEqual(["a", "b"]);
  });
});

describe("getMateriasHabilitadas", () => {
  it("devuelve solo materias que se pueden empezar a cursar ahora", () => {
    const grafo = buildGrafo([
      materia("aprobada", "aprobada"),
      materia("regular", "regular"),
      materia("cursando", "cursando"),
      materia("libre", "libre"),
      materia("pendiente", "pendiente"),
    ]);
    // Aprobada/regular/cursando ya están encaminadas: no son "para cursar ahora".
    expect(getMateriasHabilitadas(grafo).map((n) => n.id).sort()).toEqual(["libre", "pendiente"]);
  });

  it("excluye materias bloqueadas por correlativas", () => {
    const grafo = buildGrafo([materia("a", "pendiente"), materia("b", "pendiente", ["a"])]);
    expect(getMateriasHabilitadas(grafo).map((n) => n.id)).toEqual(["a"]);
  });
});

describe("getMateriasBloqueadas", () => {
  it("devuelve las pendientes que tienen correlativas sin cumplir", () => {
    const grafo = buildGrafo([materia("a", "pendiente"), materia("b", "pendiente", ["a"])]);
    expect(getMateriasBloqueadas(grafo).map((n) => n.id)).toEqual(["b"]);
  });

  it("no incluye materias ya aprobadas aunque tengan correlativas sin cumplir", () => {
    // Caso real: alguien aprobó por equivalencia sin tener la correlativa.
    const grafo = buildGrafo([materia("a", "pendiente"), materia("b", "aprobada", ["a"])]);
    expect(getMateriasBloqueadas(grafo)).toEqual([]);
  });
});

describe("ordenTopologico", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ordena una cadena de correlativas de la primera a la última", () => {
    const materias = [
      materia("c", "pendiente", ["b"]),
      materia("a", "pendiente"),
      materia("b", "pendiente", ["a"]),
    ];
    expect(ordenTopologico(materias)).toEqual(["a", "b", "c"]);
  });

  it("pone primero las materias sin correlativas pendientes", () => {
    const materias = [
      materia("avanzada", "pendiente", ["base"]),
      materia("base", "pendiente"),
      materia("suelta", "pendiente"),
    ];
    const orden = ordenTopologico(materias);
    expect(orden.indexOf("base")).toBeLessThan(orden.indexOf("avanzada"));
    expect(orden).toContain("suelta");
  });

  it("trata como disponible una materia cuya correlativa ya está aprobada", () => {
    // Las aprobadas no suman grado de entrada, así que la siguiente arranca libre.
    const materias = [materia("a", "aprobada"), materia("b", "pendiente", ["a"])];
    expect(ordenTopologico(materias)).toContain("b");
  });

  it("ante un ciclo devuelve el orden original en vez de perder materias", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const materias = [
      materia("a", "pendiente", ["b"]),
      materia("b", "pendiente", ["a"]),
    ];
    // Un ciclo es un error de carga; preferimos mostrar todo antes que ocultarlo.
    expect(ordenTopologico(materias).sort()).toEqual(["a", "b"]);
  });

  it("devuelve array vacío si no hay materias", () => {
    expect(ordenTopologico([])).toEqual([]);
  });
});
