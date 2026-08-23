// src/app/api/comentarios/reportar/route.ts
export const dynamic = "force-dynamic";
//
// Reportar un comentario. Al juntar REPORTES_PARA_OCULTAR reportes de personas
// distintas, el comentario se oculta solo — así el contenido problemático no
// queda visible esperando a que alguien lo revise a mano.
//
// El reporte vive en `comentarios/{id}/reportes/{uid}`: el uid como ID del
// documento evita que una sola persona infle el contador reportando mil veces.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { verificarRateLimit } from "@/lib/rate-limit";
import { REPORTES_PARA_OCULTAR } from "@/lib/comentarios";

const bodySchema = z.object({
  materia_catalogo_id: z.string().trim().min(1).max(256),
  comentario_id: z.string().trim().min(1).max(128),
  motivo: z.string().trim().max(300).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    const uid = decoded.uid;

    const limite = verificarRateLimit(`reportar:${uid}`, 20, 60_000);
    if (!limite.permitido) {
      return NextResponse.json({ error: "Demasiados reportes seguidos." }, { status: 429 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }
    const { materia_catalogo_id, comentario_id, motivo } = parsed.data;

    const comentarioRef = adminDb
      .collection("catalogo_materias")
      .doc(materia_catalogo_id)
      .collection("comentarios")
      .doc(comentario_id);
    const reporteRef = comentarioRef.collection("reportes").doc(uid);

    const resultado = await adminDb.runTransaction(async (tx) => {
      const [comentarioSnap, reporteSnap] = await Promise.all([
        tx.get(comentarioRef),
        tx.get(reporteRef),
      ]);

      if (!comentarioSnap.exists) return null;
      // Ya lo había reportado: no suma de nuevo.
      if (reporteSnap.exists) return { yaReportado: true, oculto: comentarioSnap.data()?.oculto ?? false };

      const reportes = (comentarioSnap.data()?.reportes ?? 0) + 1;
      const oculto = reportes >= REPORTES_PARA_OCULTAR;

      tx.set(reporteRef, {
        motivo: motivo ?? null,
        creado_en: new Date().toISOString(),
      });
      tx.update(comentarioRef, { reportes, oculto });

      return { yaReportado: false, oculto };
    });

    if (!resultado) {
      return NextResponse.json({ error: "El comentario no existe." }, { status: 404 });
    }

    return NextResponse.json(resultado);
  } catch (error) {
    console.error("[Comentarios] Error al reportar:", error);
    return NextResponse.json({ error: "No se pudo registrar el reporte." }, { status: 500 });
  }
}
