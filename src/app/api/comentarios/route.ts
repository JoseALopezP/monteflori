// src/app/api/comentarios/route.ts
export const dynamic = "force-dynamic";
//
// Crear un comentario sobre una materia del catálogo.
//
// Todo pasa por acá (las reglas de Firestore no dejan escribir comentarios
// desde el cliente) porque es lo único que permite validar de verdad: largo del
// texto, dominios de los links, cooldown y tope diario. Cualquier validación
// que viva solo en el formulario se saltea con la consola del navegador.
//
// Se publica con el ALIAS del perfil, no con el nombre real: opinar sobre una
// cátedra con nombre y apellido puede exponer al estudiante frente al docente.
// El uid queda guardado para poder moderar, pero nunca se muestra.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { verificarRateLimit } from "@/lib/rate-limit";
import { validarComentario, puedeComentar, TEXTO_MAX } from "@/lib/comentarios";

const bodySchema = z.object({
  materia_catalogo_id: z.string().trim().min(1).max(256),
  texto: z.string().max(TEXTO_MAX * 2), // el largo fino lo valida validarComentario
  carrera_contexto: z.string().trim().max(200).nullish(),
});

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    const uid = decoded.uid;

    const limiteRate = verificarRateLimit(`comentario:${uid}`, 10, 60_000);
    if (!limiteRate.permitido) {
      return NextResponse.json(
        { error: "Demasiados intentos seguidos." },
        { status: 429, headers: { "Retry-After": String(limiteRate.reintentarEn) } }
      );
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }
    const { materia_catalogo_id, texto, carrera_contexto } = parsed.data;

    const validacion = validarComentario(texto);
    if (!validacion.valido) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    const usuarioRef = adminDb.collection("usuarios").doc(uid);
    const usuarioSnap = await usuarioRef.get();
    const datosUsuario = usuarioSnap.data();

    const alias = datosUsuario?.perfil?.alias?.trim();
    if (!alias) {
      return NextResponse.json(
        { error: "Elegí un apodo en tu perfil antes de comentar.", motivo: "falta_alias" },
        { status: 400 }
      );
    }

    const permiso = puedeComentar(datosUsuario?.uso);
    if (!permiso.valido) {
      return NextResponse.json({ error: permiso.error, motivo: "limite" }, { status: 429 });
    }

    const materiaRef = adminDb.collection("catalogo_materias").doc(materia_catalogo_id);
    const materiaSnap = await materiaRef.get();
    if (!materiaSnap.exists) {
      return NextResponse.json({ error: "Esa materia no existe en el catálogo." }, { status: 404 });
    }

    const ahora = new Date();
    const comentarioRef = materiaRef.collection("comentarios").doc();

    await adminDb.runTransaction(async (tx) => {
      tx.set(comentarioRef, {
        autor_uid: uid,
        autor_alias: alias,
        texto: texto.trim(),
        links: validacion.links,
        carrera_contexto: carrera_contexto ?? null,
        creado_en: ahora.toISOString(),
        votos_positivos: 0,
        votos_negativos: 0,
        puntaje: 0,
        reportes: 0,
        oculto: false,
      });

      tx.update(materiaRef, {
        comentarios_count: (materiaSnap.data()?.comentarios_count ?? 0) + 1,
      });

      const dia = ahora.toISOString().slice(0, 10);
      const esDeHoy = datosUsuario?.uso?.dia_comentarios === dia;
      tx.set(
        usuarioRef,
        {
          uso: {
            ultimo_comentario_en: ahora.toISOString(),
            dia_comentarios: dia,
            comentarios_hoy: (esDeHoy ? datosUsuario?.uso?.comentarios_hoy ?? 0 : 0) + 1,
          },
        },
        { merge: true }
      );
    });

    return NextResponse.json({ id: comentarioRef.id });
  } catch (error) {
    console.error("[Comentarios] Error al crear:", error);
    return NextResponse.json({ error: "No se pudo publicar el comentario." }, { status: 500 });
  }
}
