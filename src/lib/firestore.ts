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
  query,
  orderBy,
  onSnapshot,
  writeBatch,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { ActoAcademico, Materia, Carrera, Usuario, Evaluacion, FechaImportante } from "@/types";
import type { MateriaScrapeada } from "./extensionSync";
import { COLORES_CARRERA } from "./estados";

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


// updatePerfil/updateConfiguracion usan setDoc+merge para poder crear el
// documento si no existía (ver comentario ahí) — eso puede dejar un doc
// con solo "perfil" o solo "configuracion". Normalizamos acá para que el
// resto de la app pueda asumir siempre que ambos existen.
function normalizarUsuario(uid: string, data: Partial<Usuario>): Usuario {
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

export async function getPerfilUsuario(uid: string): Promise<Usuario | null> {
  const snap = await getDoc(paths.usuario(uid));
  if (!snap.exists()) return null;
  return normalizarUsuario(uid, snap.data() as Partial<Usuario>);
}

/** Perfil en tiempo real: refleja al instante lo que escribe el servidor (Calendar, donación). */
export function suscribirPerfil(
  uid: string,
  callback: (perfil: Usuario | null) => void,
  onError?: () => void
): Unsubscribe {
  return onSnapshot(
    paths.usuario(uid),
    (snap) => callback(snap.exists() ? normalizarUsuario(uid, snap.data() as Partial<Usuario>) : null),
    () => onError?.()
  );
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

/**
 * Borra una carrera y la desvincula de todas las materias que la tenían. Las
 * materias no se borran. Sin la desvinculación quedaban apuntando a una carrera
 * inexistente.
 */
export async function deleteCarrera(uid: string, cid: string, materias: Materia[] = []): Promise<void> {
  const batch = writeBatch(db);
  materias
    .filter((m) => m.carreras_vinculadas?.includes(cid))
    .forEach((m) =>
      batch.update(paths.materia(uid, m.id), {
        carreras_vinculadas: (m.carreras_vinculadas ?? []).filter((c) => c !== cid),
      })
    );
  batch.delete(paths.carrera(uid, cid));
  await batch.commit();
}

export function suscribirCarreras(
  uid: string,
  callback: (carreras: Carrera[]) => void,
  onError?: () => void
): Unsubscribe {
  return onSnapshot(
    paths.carreras(uid),
    (snap) => {
      const carreras = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Carrera));
      carreras.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      // Las carreras creadas por la importación no traen color: se les da uno
      // distinto a cada una para poder diferenciarlas (solo para mostrar).
      callback(
        carreras.map((c, i) => ({ ...c, color: c.color ?? COLORES_CARRERA[i % COLORES_CARRERA.length] }))
      );
    },
    () => onError?.()
  );
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

/**
 * Borra una materia y la saca de las correlativas de las demás, para que
 * ninguna quede esperando una materia que ya no existe.
 */
export async function deleteMateria(uid: string, mid: string, materias: Materia[] = []): Promise<void> {
  const batch = writeBatch(db);
  materias
    .filter((m) => m.id !== mid && m.correlativas_requisito?.includes(mid))
    .forEach((m) =>
      batch.update(paths.materia(uid, m.id), {
        correlativas_requisito: (m.correlativas_requisito ?? []).filter((c) => c !== mid),
      })
    );
  batch.delete(paths.materia(uid, mid));
  await batch.commit();
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

export async function updateFechaImportante(
  uid: string,
  mid: string,
  fechaId: string,
  cambios: Partial<Omit<FechaImportante, "id">>,
  fechasActuales?: FechaImportante[]
): Promise<void> {
  const actualizadas = (fechasActuales ?? []).map((f) =>
    f.id === fechaId ? { ...f, ...cambios } : f
  );
  await updateDoc(paths.materia(uid, mid), {
    fechas_importantes: actualizadas,
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
  callback: (materias: Materia[]) => void,
  onError?: () => void
): Unsubscribe {
  return onSnapshot(
    paths.materias(uid),
    (snap) => {
      const materias = snap.docs.map((d) => {
        const data = d.data() as Omit<Materia, "id">;
        // Documentos viejos o importados pueden venir sin estas listas.
        return { ...data, id: d.id, evaluaciones: data.evaluaciones ?? [] } as Materia;
      });
      // El snapshot no garantiza orden: sin esto las listas saltaban de lugar.
      materias.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      callback(materias);
    },
    () => onError?.()
  );
}

// ── Import masivo desde el scraping de la extensión ────────

/** Tope de actos por materia: sobra para cualquier historia real y acota el documento. */
const MAX_ACTOS = 60;

/**
 * Deja los actos listos para guardar: solo los campos conocidos (lo que manda
 * la extensión no se guarda a ciegas) y nunca undefined.
 */
function limpiarActos(actos: ActoAcademico[] | undefined): ActoAcademico[] | undefined {
  if (!actos || actos.length === 0) return undefined;
  return actos.slice(0, MAX_ACTOS).map((a) => ({
    tipo: a.tipo,
    resultado: a.resultado ?? null,
    nota: typeof a.nota === "number" ? a.nota : null,
    fecha: a.fecha ?? null,
    vencimiento: a.vencimiento ?? null,
  }));
}

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
        // Si esta sincronización no trajo historia, se conserva la que había.
        actos_academicos: limpiarActos(ms.actos_academicos) ?? existente.actos_academicos,
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
        actos_academicos: limpiarActos(ms.actos_academicos),
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
