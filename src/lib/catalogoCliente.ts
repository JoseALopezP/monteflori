// src/lib/catalogoCliente.ts
// Llamadas del cliente al catálogo compartido.
//
// Escribir el catálogo pasa siempre por la API (el cliente no tiene permiso en
// las reglas). Leer, en cambio, se hace directo contra Firestore: es contenido
// público y así el autocompletado no necesita una ruta intermedia.

import { User } from "firebase/auth";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { rangoBusquedaPrefijo } from "./catalogo";
import { MateriaCatalogo } from "@/types";

export interface MateriaAVincular {
  materia_id: string;
  nombre: string;
  codigo?: string | null;
  carrera?: string | null;
}

/**
 * Vincula materias del usuario con el catálogo. No lanza: que falle el vínculo
 * no debería romper el flujo principal (importar o crear una materia), porque
 * la materia del usuario ya quedó guardada de todos modos.
 *
 * @param institucion hostname del portal, o nombre de la institución si se cargó a mano
 */
export async function vincularConCatalogo(
  user: User,
  institucion: string,
  materias: MateriaAVincular[]
): Promise<Record<string, string> | null> {
  if (materias.length === 0) return null;
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/catalogo/vincular", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ institucion, materias }),
    });
    if (!res.ok) return null;
    const datos = await res.json();
    return datos.vinculos ?? null;
  } catch {
    return null;
  }
}

/**
 * Busca materias del catálogo por prefijo del nombre, para sugerir
 * "esta materia ya existe" cuando alguien la carga a mano.
 */
export async function buscarEnCatalogo(
  institucionId: string,
  consulta: string,
  maximo = 5
): Promise<MateriaCatalogo[]> {
  const texto = consulta.trim();
  if (!institucionId || texto.length < 3) return [];

  const { desde, hasta } = rangoBusquedaPrefijo(texto);

  try {
    const q = query(
      collection(db, "catalogo_materias"),
      where("institucion_id", "==", institucionId),
      where("nombre_normalizado", ">=", desde),
      where("nombre_normalizado", "<=", hasta),
      orderBy("nombre_normalizado"),
      limit(maximo)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MateriaCatalogo);
  } catch {
    // Falta el índice compuesto, o no hay permisos: la búsqueda es una ayuda,
    // no un requisito para poder crear la materia.
    return [];
  }
}
