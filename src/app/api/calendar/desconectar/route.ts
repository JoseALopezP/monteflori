// src/app/api/calendar/desconectar/route.ts
export const dynamic = "force-dynamic";
// Da de baja la sincronización con Google Calendar.
//
// Borra el refresh token, el mapa de eventos sincronizados y el error guardado.
// Los eventos ya creados quedan en el calendario del usuario a propósito: son
// suyos, y borrarlos sin que lo pida sería tocarle datos personales de más.

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { verificarRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    const uid = decoded.uid;

    const limiteRate = verificarRateLimit(`calendar-desconectar:${uid}`, 10, 60_000);
    if (!limiteRate.permitido) {
      return NextResponse.json({ error: "Demasiados intentos seguidos." }, { status: 429 });
    }

    await adminDb.collection("usuarios").doc(uid).set(
      {
        credenciales_externas: {
          google_calendar_refresh_token: FieldValue.delete(),
        },
        uso: {
          calendar_eventos: FieldValue.delete(),
          calendar_ultimo_error: FieldValue.delete(),
          ultima_reconciliacion_calendar: FieldValue.delete(),
        },
      },
      { merge: true }
    );

    console.log(`[Calendar] Desconectado para uid: ${uid}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Calendar Desconectar] Error:", error);
    return NextResponse.json({ error: "No se pudo desconectar." }, { status: 500 });
  }
}
