// src/app/api/admin/moderacion/route.ts
export const dynamic = "force-dynamic";
//
// Panel de moderación: listar lo reportado y decidir qué hacer.
//
// GET  -> comentarios ocultos o con reportes
// POST -> restaurar (lo vuelve visible y limpia los reportes) o eliminar
//
// El auto-ocultado por reportes cubre mientras nadie mira; esto es para revisar
// después y poder revertir un ocultamiento injusto.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { esAdmin } from "@/lib/admin";

async function requerirAdmin(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    return esAdmin(decoded.uid) ? decoded.uid : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const uid = await requerirAdmin(request);
  // 404 en vez de 403: no confirmamos que la ruta exista a quien no es admin.
  if (!uid) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  try {
    // collectionGroup permite barrer los comentarios de todas las materias.
    const snap = await adminDb
      .collectionGroup("comentarios")
      .where("reportes", ">", 0)
      .orderBy("reportes", "desc")
      .limit(100)
      .get();

    const comentarios = snap.docs.map((d) => ({
      id: d.id,
      // El padre del padre es el documento del catálogo.
      materia_catalogo_id: d.ref.parent.parent?.id ?? null,
      ...d.data(),
    }));

    return NextResponse.json({ comentarios });
  } catch (error) {
    console.error("[Moderación] Error al listar:", error);
    return NextResponse.json({ error: "No se pudo listar." }, { status: 500 });
  }
}

const accionSchema = z.object({
  materia_catalogo_id: z.string().trim().min(1).max(256),
  comentario_id: z.string().trim().min(1).max(128),
  accion: z.enum(["restaurar", "eliminar"]),
});

export async function POST(request: NextRequest) {
  const uid = await requerirAdmin(request);
  if (!uid) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  try {
    const parsed = accionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }
    const { materia_catalogo_id, comentario_id, accion } = parsed.data;

    const materiaRef = adminDb.collection("catalogo_materias").doc(materia_catalogo_id);
    const comentarioRef = materiaRef.collection("comentarios").doc(comentario_id);

    if (accion === "restaurar") {
      // Se limpian los reportes: si no, el próximo reporte lo volvería a ocultar.
      await comentarioRef.update({ oculto: false, reportes: 0 });
      const reportes = await comentarioRef.collection("reportes").get();
      const lote = adminDb.batch();
      reportes.docs.forEach((d) => lote.delete(d.ref));
      await lote.commit();
    } else {
      await comentarioRef.delete();
      const materiaSnap = await materiaRef.get();
      const actual = materiaSnap.data()?.comentarios_count ?? 0;
      await materiaRef.update({ comentarios_count: Math.max(0, actual - 1) });
    }

    console.log(`[Moderación] ${accion} sobre ${comentario_id} por admin ${uid}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Moderación] Error:", error);
    return NextResponse.json({ error: "No se pudo aplicar la acción." }, { status: 500 });
  }
}
