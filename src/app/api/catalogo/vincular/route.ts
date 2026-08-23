// src/app/api/catalogo/vincular/route.ts
export const dynamic = "force-dynamic";
//
// Busca o crea la entrada del catálogo compartido que corresponde a una materia
// y la vincula a la materia privada del usuario.
//
// El catálogo se escribe SOLO desde acá (con el Admin SDK, que ignora las
// reglas de Firestore). Si el cliente pudiera escribirlo, cualquiera podría
// llenarlo de entradas basura o duplicadas, y los comentarios perderían sentido
// porque nadie estaría mirando la misma materia.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { verificarRateLimit } from "@/lib/rate-limit";
import { claveDeDedup, institucionIdDesdeHostname, normalizarTexto } from "@/lib/catalogo";

const MAX_MATERIAS_POR_LOTE = 200;

const materiaSchema = z.object({
  /** ID de la materia privada del usuario, para escribirle el vínculo. */
  materia_id: z.string().trim().min(1).max(128),
  nombre: z.string().trim().min(1).max(200),
  codigo: z.string().trim().max(50).nullish(),
  carrera: z.string().trim().max(200).nullish(),
});

const bodySchema = z.object({
  /** Hostname del portal (scraping) o nombre de la institución (carga manual). */
  institucion: z.string().trim().min(1).max(200),
  materias: z.array(materiaSchema).min(1).max(MAX_MATERIAS_POR_LOTE),
});

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    const uid = decoded.uid;

    const limite = verificarRateLimit(`catalogo:${uid}`, 30, 60_000);
    if (!limite.permitido) {
      return NextResponse.json(
        { error: "Demasiadas peticiones seguidas." },
        { status: 429, headers: { "Retry-After": String(limite.reintentarEn) } }
      );
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }
    const { institucion, materias } = parsed.data;

    // El hostname del scraper ("autogestion.guarani.unsj.edu.ar") y el nombre
    // suelto de una carrera cargada a mano ("UNSJ") tienen que caer en la misma
    // clave para que compartan catálogo.
    const institucionId = institucion.includes(".")
      ? institucionIdDesdeHostname(institucion)
      : normalizarTexto(institucion);

    if (!institucionId) {
      return NextResponse.json({ error: "No se pudo identificar la institución." }, { status: 400 });
    }

    const vinculos: Record<string, string> = {};

    for (const m of materias) {
      const clave = claveDeDedup(institucionId, m.codigo, m.nombre);
      const carreraNorm = m.carrera ? normalizarTexto(m.carrera) : null;

      // El id del documento ES la clave de dedup: dos usuarios que cargan la
      // misma materia terminan en el mismo documento sin necesidad de buscar.
      const ref = adminDb.collection("catalogo_materias").doc(encodeURIComponent(clave));
      // Presencia = este usuario tiene la materia. Es lo que permite que
      // `cantidad_usuarios` sea un número real y no se infle si alguien
      // sincroniza diez veces.
      const refUsuario = ref.collection("usuarios").doc(uid);

      const catalogoId = await adminDb.runTransaction(async (tx) => {
        // Firestore exige todas las lecturas antes de cualquier escritura.
        const [snap, snapUsuario] = await Promise.all([tx.get(ref), tx.get(refUsuario)]);
        const esUsuarioNuevo = !snapUsuario.exists;

        if (!snap.exists) {
          tx.set(ref, {
            institucion_id: institucionId,
            institucion_nombre: institucion,
            codigo: m.codigo ?? null,
            nombre_canonico: m.nombre,
            nombre_normalizado: normalizarTexto(m.nombre),
            carreras: carreraNorm ? [carreraNorm] : [],
            cantidad_usuarios: 1,
            comentarios_count: 0,
            creado_en: new Date().toISOString(),
          });
        } else {
          const datos = snap.data() ?? {};
          const cambios: Record<string, unknown> = {};

          // Sumar la carrera si es la primera vez que aparece en ella.
          const carrerasActuales: string[] = datos.carreras ?? [];
          if (carreraNorm && !carrerasActuales.includes(carreraNorm)) {
            cambios.carreras = [...carrerasActuales, carreraNorm].slice(0, 50);
          }

          // Si la entrada se creó sin código y ahora llega uno, se completa.
          if (!datos.codigo && m.codigo) cambios.codigo = m.codigo;

          if (esUsuarioNuevo) {
            cambios.cantidad_usuarios = (datos.cantidad_usuarios ?? 0) + 1;
          }

          if (Object.keys(cambios).length > 0) tx.update(ref, cambios);
        }

        if (esUsuarioNuevo) {
          tx.set(refUsuario, { vinculado_en: new Date().toISOString() });
        }

        return ref.id;
      });

      vinculos[m.materia_id] = catalogoId;
    }

    // Escribir el vínculo en las materias privadas del usuario.
    const lote = adminDb.batch();
    for (const [materiaId, catalogoId] of Object.entries(vinculos)) {
      lote.set(
        adminDb.collection("usuarios").doc(uid).collection("materias").doc(materiaId),
        { catalogo_id: catalogoId },
        { merge: true }
      );
    }
    await lote.commit();

    return NextResponse.json({ vinculos });
  } catch (error) {
    console.error("[Catálogo] Error al vincular:", error);
    return NextResponse.json({ error: "No se pudo vincular con el catálogo." }, { status: 500 });
  }
}
