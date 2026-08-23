// src/lib/firestore.ts
// Helper functions para interactuar con Firestore (client-side)
// Todas las funciones asumen que el usuario está autenticado

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { Materia, Carrera, Usuario, Evaluacion, FechaImportante } from "@/types";
import type { MateriaScrapeada } from "./extensionSync";

// ── Rutas de colecciones ──────────────────────────────────

export const paths = {
  usuario: (uid: string) => doc(db, "usuarios", uid),
  carreras: (uid: string) => collection(db, "usuarios", uid, "carreras"),
  carrera: (uid: string, cid: string) => doc(db, "usuarios", uid, "carreras", cid),
  materias: (uid: string) => collection(db, "usuarios", uid, "materias"),
  materia: (uid: string, mid: string) => doc(db, "usuarios", uid, "materias", mid),
};

// ── Usuario ────────────────────────────────────────────────

export async function crearPerfilUsuario(
  uid: string,
  nombre: string,
  email: string,
  universidad?: string
): Promise<void> {
  const ref = paths.usuario(uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      perfil: {
        nombre,
        email,
        fecha_creacion: new Date().toISOString(),
        ...(universidad ? { universidad } : {}),
      },
      configuracion: {
        tema: "sistema",
        notificaciones_whatsapp: true,
        notificaciones_email: true,
        carrera_activa: null,
      },
      // credenciales_externas / suscripcion / uso los escribe solo el servidor
      // (ver firestore.rules): el cliente ni siquiera puede inicializarlos.
    });
  }
}


export async function getPerfilUsuario(uid: string): Promise<Usuario | null> {
  const snap = await getDoc(paths.usuario(uid));
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<Usuario>;
  // updatePerfil/updateConfiguracion usan setDoc+merge para poder crear el
  // documento si no existía (ver comentario ahí) — eso puede dejar un doc
  // con solo "perfil" o solo "configuracion". Normalizamos acá para que el
  // resto de la app pueda asumir siempre que ambos existen.
  return {
    uid,
    ...data,
    perfil: { nombre: "", email: "", fecha_creacion: "", ...data.perfil },
    configuracion: {
      tema: "sistema",
      notificaciones_whatsapp: true,
      notificaciones_email: true,
      ...data.configuracion,
    },
  } as Usuario;
}

export async function updateConfiguracion(
  uid: string,
  datos: Partial<Usuario["configuracion"]>
): Promise<void> {
  // setDoc + merge en vez de updateDoc: si el documento del usuario todavía
  // no existe (ej. primer login con Google desde /login, que no pasa por
  // crearPerfilUsuario), esto lo crea en vez de tirar "No document to update".
  await setDoc(paths.usuario(uid), { configuracion: datos }, { merge: true });
}

export async function updatePerfil(
  uid: string,
  datos: Partial<Usuario["perfil"]>
): Promise<void> {
  await setDoc(paths.usuario(uid), { perfil: datos }, { merge: true });
}



// ── Carreras ───────────────────────────────────────────────

export async function getCarreras(uid: string): Promise<Carrera[]> {
  const snap = await getDocs(paths.carreras(uid));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Carrera));
}

export async function addCarrera(uid: string, carrera: Omit<Carrera, "id">): Promise<string> {
  const ref = await addDoc(paths.carreras(uid), carrera);
  return ref.id;
}

export async function updateCarrera(uid: string, cid: string, datos: Partial<Carrera>): Promise<void> {
  await updateDoc(paths.carrera(uid, cid), datos);
}

export async function deleteCarrera(uid: string, cid: string): Promise<void> {
  await deleteDoc(paths.carrera(uid, cid));
}

// ── Materias ───────────────────────────────────────────────

export async function getMaterias(uid: string): Promise<Materia[]> {
  const snap = await getDocs(query(paths.materias(uid), orderBy("nombre")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Materia));
}

export async function addMateria(uid: string, materia: Omit<Materia, "id">): Promise<string> {
  const ref = await addDoc(paths.materias(uid), {
    ...materia,
    ultima_actualizacion: new Date().toISOString(),
  });
  return ref.id;
}

export async function updateMateria(
  uid: string,
  mid: string,
  datos: Partial<Materia>
): Promise<void> {
  await updateDoc(paths.materia(uid, mid), {
    ...datos,
    ultima_actualizacion: new Date().toISOString(),
  });
}

export async function deleteMateria(uid: string, mid: string): Promise<void> {
  await deleteDoc(paths.materia(uid, mid));
}

// ── Evaluaciones (dentro de una materia) ──────────────────

export async function addEvaluacion(
  uid: string,
  mid: string,
  evaluacion: Omit<Evaluacion, "id"> & { id?: string },
  evaluacionesActuales: Evaluacion[]
): Promise<void> {
  const nuevaEval: Evaluacion = {
    ...evaluacion,
    id: evaluacion.id || `eval_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  };
  await updateDoc(paths.materia(uid, mid), {
    evaluaciones: [...evaluacionesActuales, nuevaEval],
    ultima_actualizacion: new Date().toISOString(),
  });
}

export async function updateEvaluacion(
  uid: string,
  mid: string,
  evaluacionId: string,
  cambios: Partial<Omit<Evaluacion, "id">>,
  evaluacionesActuales: Evaluacion[]
): Promise<void> {
  const actualizadas = evaluacionesActuales.map((e) =>
    e.id === evaluacionId ? { ...e, ...cambios } : e
  );
  await updateDoc(paths.materia(uid, mid), {
    evaluaciones: actualizadas,
    ultima_actualizacion: new Date().toISOString(),
  });
}

export async function deleteEvaluacion(
  uid: string,
  mid: string,
  evaluacionId: string,
  evaluacionesActuales: Evaluacion[]
): Promise<void> {
  const filtradas = evaluacionesActuales.filter((e) => e.id !== evaluacionId);
  await updateDoc(paths.materia(uid, mid), {
    evaluaciones: filtradas,
    ultima_actualizacion: new Date().toISOString(),
  });
}

// ── Fechas importantes ─────────────────────────────────────

export async function addFechaImportante(
  uid: string,
  mid: string,
  fecha: Omit<FechaImportante, "id"> & { id?: string },
  fechasActuales?: FechaImportante[]
): Promise<void> {
  const actualList = fechasActuales ?? [];
  const nuevaFecha: FechaImportante = {
    ...fecha,
    id: fecha.id || `fecha_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  };
  await updateDoc(paths.materia(uid, mid), {
    fechas_importantes: [...actualList, nuevaFecha],
    ultima_actualizacion: new Date().toISOString(),
  });
}

export async function deleteFechaImportante(
  uid: string,
  mid: string,
  fechaId: string,
  fechasActuales?: FechaImportante[]
): Promise<void> {
  const actualList = fechasActuales ?? [];
  const filtradas = actualList.filter((f) => f.id !== fechaId);
  await updateDoc(paths.materia(uid, mid), {
    fechas_importantes: filtradas,
    ultima_actualizacion: new Date().toISOString(),
  });
}

// ── Suscripción en tiempo real ─────────────────────────────

export function suscribirMaterias(
  uid: string,
  callback: (materias: Materia[]) => void
): Unsubscribe {
  return onSnapshot(paths.materias(uid), (snap) => {
    const materias = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Materia));
    callback(materias);
  });
}

// ── Import masivo desde el scraping de la extensión ────────

function normalizarNombre(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Crea/actualiza materias a partir de lo detectado por la extensión.
 * Fase 1: upsert de cada materia (matching por nombre normalizado).
 * Fase 2: ahora que todas tienen ID real, resuelve correlativas_requisito
 * por nombre (las correlativas de SIU Guaraní vienen sin código, solo nombre).
 */
export async function importarMateriasScrapeadas(
  uid: string,
  carreraId: string | null,
  materiasScrapeadas: MateriaScrapeada[],
  materiasExistentes: Materia[]
): Promise<{
  creadas: number;
  actualizadas: number;
  /** IDs resultantes, para poder vincularlas después con el catálogo compartido. */
  importadas: { id: string; nombre: string; codigo: string | null }[];
}> {
  const existentesPorNombre = new Map<string, Materia>();
  materiasExistentes.forEach((m) => existentesPorNombre.set(normalizarNombre(m.nombre), m));

  const idPorNombre = new Map<string, string>();
  let creadas = 0;
  let actualizadas = 0;

  for (const ms of materiasScrapeadas) {
    const clave = normalizarNombre(ms.nombre);
    const existente = existentesPorNombre.get(clave);

    const vinculadas = carreraId
      ? Array.from(new Set([...(existente?.carreras_vinculadas ?? []), carreraId]))
      : existente?.carreras_vinculadas;

    if (existente) {
      const evaluaciones = [...existente.evaluaciones];
      const yaTieneNotaSiu = evaluaciones.some((e) => e.nombre === "Nota SIU Guaraní");
      if (ms.nota !== null && !yaTieneNotaSiu) {
        evaluaciones.push({
          id: `eval_siu_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          nombre: "Nota SIU Guaraní",
          tipo: "otro",
          nota: ms.nota,
          fecha: ms.fecha_aprobacion ?? null,
        });
      }
      await updateMateria(uid, existente.id, {
        estado: ms.estado,
        año_plan: ms.año_plan ?? existente.año_plan,
        cuatrimestre_plan: ms.cuatrimestre_plan ?? existente.cuatrimestre_plan,
        codigo_interno: ms.codigo_interno ?? existente.codigo_interno,
        carreras_vinculadas: vinculadas,
        evaluaciones,
      });
      idPorNombre.set(clave, existente.id);
      actualizadas++;
    } else {
      const evaluaciones: Evaluacion[] =
        ms.nota !== null
          ? [
              {
                id: `eval_siu_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                nombre: "Nota SIU Guaraní",
                tipo: "otro",
                nota: ms.nota,
                fecha: ms.fecha_aprobacion ?? null,
              },
            ]
          : [];

      const nuevoId = await addMateria(uid, {
        nombre: ms.nombre,
        codigo_interno: ms.codigo_interno,
        estado: ms.estado,
        año_plan: ms.año_plan,
        cuatrimestre_plan: ms.cuatrimestre_plan,
        carreras_vinculadas: carreraId ? [carreraId] : undefined,
        configuracion_nota: { sistema: "lineal", nota_aprobar: 4, nota_promocionar: 7 },
        evaluaciones,
        ultima_actualizacion: new Date().toISOString(),
      });
      idPorNombre.set(clave, nuevoId);
      creadas++;
    }
  }

  // Fase 2: correlativas (por nombre, ahora que todas tienen ID)
  for (const ms of materiasScrapeadas) {
    if (!ms.correlativas_nombres?.length) continue;
    const id = idPorNombre.get(normalizarNombre(ms.nombre));
    if (!id) continue;

    const correlativas_requisito = ms.correlativas_nombres
      .map((nombre) => {
        const clave = normalizarNombre(nombre);
        return idPorNombre.get(clave) ?? existentesPorNombre.get(clave)?.id;
      })
      .filter((x): x is string => !!x);

    if (correlativas_requisito.length > 0) {
      await updateMateria(uid, id, { correlativas_requisito });
    }
  }

  const importadas = materiasScrapeadas
    .map((ms) => {
      const id = idPorNombre.get(normalizarNombre(ms.nombre));
      return id ? { id, nombre: ms.nombre, codigo: ms.codigo_interno ?? null } : null;
    })
    .filter((x): x is { id: string; nombre: string; codigo: string | null } => x !== null);

  return { creadas, actualizadas, importadas };
}

export function buildPhoneQuery(telefono: string) {
  return query(
    collection(db, "usuarios"),
    where("configuracion.telefono_whatsapp", "==", telefono)
  );
}
