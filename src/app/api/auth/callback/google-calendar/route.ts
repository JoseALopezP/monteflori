// src/app/api/auth/callback/google-calendar/route.ts
export const dynamic = "force-dynamic";
// Maneja el redirect OAuth de Google Calendar y guarda el refresh_token en Firestore.
// El usuario se identifica por el `state` firmado que emitió /api/auth/google-calendar/start,
// no por el email de Google (que puede no coincidir con el de la cuenta de Firebase).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { verificarState } from "@/lib/oauth-state";

const respuestaTokenSchema = z.object({
  refresh_token: z.string().min(1).optional(),
  access_token: z.string().min(1).optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (error || !code) {
    console.error("[Google Calendar OAuth] Error o code ausente:", error);
    return NextResponse.redirect(`${baseUrl}/configuracion?calendar=error`);
  }

  // Anti-CSRF: sin un state válido y vigente no seguimos. Esto también nos dice
  // a qué usuario pertenece el flujo.
  const uid = verificarState(state);
  if (!uid) {
    console.warn("[Google Calendar OAuth] State inválido o vencido — se rechaza el callback.");
    return NextResponse.redirect(`${baseUrl}/configuracion?calendar=error`);
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${baseUrl}/api/auth/callback/google-calendar`,
        grant_type: "authorization_code",
      }),
    });

    const tokens = respuestaTokenSchema.safeParse(await tokenResponse.json());

    if (!tokens.success || !tokens.data.refresh_token) {
      // Google solo entrega refresh_token en la primera autorización. Si el usuario
      // ya había autorizado antes, no viene y no hay nada nuevo que guardar.
      console.warn("[Google Calendar OAuth] Sin refresh_token en la respuesta.");
      return NextResponse.redirect(`${baseUrl}/configuracion?calendar=sin_token`);
    }

    // setDoc+merge y no update(): si el documento del usuario todavía no existe,
    // update() falla con "No document to update".
    await adminDb
      .collection("usuarios")
      .doc(uid)
      .set(
        { credenciales_externas: { google_calendar_refresh_token: tokens.data.refresh_token } },
        { merge: true }
      );

    console.log(`[Google Calendar OAuth] Conectado para UID: ${uid}`);
    return NextResponse.redirect(`${baseUrl}/configuracion?calendar=ok`);

  } catch (err) {
    console.error("[Google Calendar OAuth] Error fatal:", err);
    return NextResponse.redirect(`${baseUrl}/configuracion?calendar=error`);
  }
}
