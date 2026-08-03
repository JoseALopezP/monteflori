// src/app/api/calendar/sync/route.ts
export const dynamic = "force-dynamic";
// Crea o actualiza eventos en Google Calendar del usuario
// Llamado desde el cliente cuando el usuario agrega una fecha importante

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    // Verificar token de Firebase del usuario
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const { nombre, fecha, descripcion } = await request.json();

    if (!nombre || !fecha) {
      return NextResponse.json({ error: "nombre y fecha son requeridos" }, { status: 400 });
    }

    // Obtener refresh_token del usuario
    const usuarioDoc = await adminDb.collection("usuarios").doc(uid).get();
    const refreshToken = usuarioDoc.data()?.credenciales_externas?.google_calendar_refresh_token;

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Google Calendar no está conectado. Ve a Configuración." },
        { status: 400 }
      );
    }

    // Obtener nuevo access_token con el refresh_token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.json({ error: "No se pudo refrescar el token de Google" }, { status: 500 });
    }

    // Crear evento en Google Calendar
    const eventoFecha = new Date(fecha);
    const eventoFechaFin = new Date(eventoFecha.getTime() + 2 * 60 * 60 * 1000); // 2 horas después

    const eventoResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: `📚 ${nombre}`,
          description: descripcion ?? "Evento generado por Monteflori",
          start: {
            dateTime: eventoFecha.toISOString(),
            timeZone: "America/Argentina/Buenos_Aires",
          },
          end: {
            dateTime: eventoFechaFin.toISOString(),
            timeZone: "America/Argentina/Buenos_Aires",
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: "popup", minutes: 60 * 24 }, // 1 día antes
              { method: "popup", minutes: 60 },       // 1 hora antes
            ],
          },
          colorId: "3", // Verde (Sage)
        }),
      }
    );

    if (!eventoResponse.ok) {
      const err = await eventoResponse.json();
      console.error("[Calendar Sync] Error de Google API:", err);
      return NextResponse.json({ error: "Error al crear evento en Google Calendar" }, { status: 500 });
    }

    const evento = await eventoResponse.json();
    console.log(`[Calendar Sync] Evento creado: ${evento.id} para uid: ${uid}`);

    return NextResponse.json({ eventId: evento.id, htmlLink: evento.htmlLink });

  } catch (error) {
    console.error("[Calendar Sync] Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
