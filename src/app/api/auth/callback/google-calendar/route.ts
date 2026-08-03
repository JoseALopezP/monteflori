// src/app/api/auth/callback/google-calendar/route.ts
export const dynamic = "force-dynamic";
// Maneja el redirect OAuth de Google Calendar y guarda el refresh_token en Firestore

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (error || !code) {
    console.error("[Google Calendar OAuth] Error:", error);
    return NextResponse.redirect(`${baseUrl}/configuracion?calendar=error`);
  }

  try {
    // Intercambiar código por tokens
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

    const tokens = await tokenResponse.json();

    if (!tokens.refresh_token) {
      // El refresh_token solo se entrega la primera vez.
      // Si no está, el usuario ya autorizó antes → access_token funciona igual para sesión actual.
      console.warn("[Google Calendar OAuth] No refresh_token recibido. Puede ser segunda autorización.");
    }

    // ⚠️ Para asociar con el usuario: necesitamos el UID.
    // Como este callback no tiene la sesión de Firebase disponible fácilmente en el servidor,
    // usamos el access_token para obtener el email del usuario y luego buscar en Firestore.
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );
    const userInfo = await userInfoResponse.json();
    const googleEmail: string = userInfo.email;

    // Buscar uid de Firebase por email
    const firebaseUser = await adminAuth.getUserByEmail(googleEmail);

    // Guardar tokens en Firestore
    const actualizaciones: Record<string, string> = {};
    if (tokens.refresh_token) {
      actualizaciones["credenciales_externas.google_calendar_refresh_token"] =
        tokens.refresh_token;
    }
    // El access_token dura 1 hora, no hace falta guardarlo

    await adminDb
      .collection("usuarios")
      .doc(firebaseUser.uid)
      .update(actualizaciones);

    console.log(`[Google Calendar OAuth] Conectado para UID: ${firebaseUser.uid}`);
    return NextResponse.redirect(`${baseUrl}/configuracion?calendar=ok`);

  } catch (err) {
    console.error("[Google Calendar OAuth] Error fatal:", err);
    return NextResponse.redirect(`${baseUrl}/configuracion?calendar=error`);
  }
}
