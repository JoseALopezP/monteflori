// src/app/api/comentarios/votar/route.ts
export const dynamic = "force-dynamic";
//
// Voto positivo/negativo sobre un comentario, para que las opiniones más útiles
// queden arriba.
//
// El voto vive en `comentarios/{id}/votos/{uid}`: usar el uid como ID del
// documento garantiza un voto por persona sin necesidad de chequear nada.
// Los contadores se actualizan en la misma transacción — si el cliente pudiera
// escribirlos, cualquiera se inventaría mil votos.
//
// Votar lo mismo dos veces cancela el voto (como en la mayoría de los foros).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { verificarRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  materia_catalogo_id: z.string().trim().min(1).max(256),
  comentario_id: z.string().trim().min(1).max(128),
  valor: z.union([z.literal(1), z.literal(-1)]),
});

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    const uid = decoded.uid;

    const limite = verificarRateLimit(`votar:${uid}`, 60, 60_000);
    if (!limite.permitido) {
      return NextResponse.json({ error: "Demasiados votos seguidos." }, { status: 429 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }
    const { materia_catalogo_id, comentario_id, valor } = parsed.data;

    const comentarioRef = adminDb
      .collection("catalogo_materias")
      .doc(materia_catalogo_id)
      .collection("comentarios")
      .doc(comentario_id);
    const votoRef = comentarioRef.collection("votos").doc(uid);

    const resultado = await adminDb.runTransaction(async (tx) => {
      const [comentarioSnap, votoSnap] = await Promise.all([
        tx.get(comentarioRef),
        tx.get(votoRef),
      ]);

      if (!comentarioSnap.exists) return null;

      const datos = comentarioSnap.data() ?? {};
      let positivos: number = datos.votos_positivos ?? 0;
      let negativos: number = datos.votos_negativos ?? 0;
      const votoPrevio = votoSnap.exists ? (votoSnap.data()?.valor as number) : 0;

      // Sacar el efecto del voto anterior, si había.
      if (votoPrevio === 1) positivos--;
      if (votoPrevio === -1) negativos--;

      if (votoPrevio === valor) {
        // Votó lo mismo de nuevo: se interpreta como quitar el voto.
        tx.delete(votoRef);
      } else {
        if (valor === 1) positivos++;
        else negativos++;
        tx.set(votoRef, { valor, creado_en: new Date().toISOString() });
      }

      positivos = Math.max(0, positivos);
      negativos = Math.max(0, negativos);

      tx.update(comentarioRef, {
        votos_positivos: positivos,
        votos_negativos: negativos,
        puntaje: positivos - negativos,
      });

      return {
        votos_positivos: positivos,
        votos_negativos: negativos,
        mi_voto: votoPrevio === valor ? 0 : valor,
      };
    });

    if (!resultado) {
      return NextResponse.json({ error: "El comentario no existe." }, { status: 404 });
    }

    return NextResponse.json(resultado);
  } catch (error) {
    console.error("[Comentarios] Error al votar:", error);
    return NextResponse.json({ error: "No se pudo registrar el voto." }, { status: 500 });
  }
}
