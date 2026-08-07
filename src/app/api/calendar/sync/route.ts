// src/app/api/calendar/sync/route.ts
export const dynamic = "force-dynamic";
// Crea o actualiza eventos en Google Calendar del usuario
// Llamado desde el cliente cuando el usuario agrega una fecha importante

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { puedeSincronizarCalendar } from "@/lib/planes";
import { verificarRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  // Tiene que ser parseable como fecha: si no, terminaría creando un evento inválido en Google.
  fecha: z.string().refine((f) => !Number.isNaN(Date.parse(f)), "fecha inválida"),
  descripcion: z.string().max(2000).optional(),
});

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

    // Cada llamada consume cuota de la API de Google, así que ponemos un techo
    // por usuario aunque sea donante (ilimitado no quiere decir sin frenos).
    const limiteRate = verificarRateLimit(`calendar:${uid}`, 20, 60_000);
    if (!limiteRate.permitido) {
      return NextResponse.json(
        { error: `Demasiadas sincronizaciones seguidas. Probá en ${limiteRate.reintentarEn} segundos.` },
        { status: 429, headers: { "Retry-After": String(limiteRate.reintentarEn) } }
      );
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos: se requiere nombre y una fecha válida." },
        { status: 400 }
      );
    }
    const { nombre, fecha, descripcion } = parsed.data;

    const usuarioDoc = await adminDb.collection("usuarios").doc(uid).get();
    const datosUsuario = usuarioDoc.data();

    // El límite se aplica acá, en el servidor: el cliente no puede saltearlo.
    const limite = puedeSincronizarCalendar(datosUsuario?.suscripcion, datosUsuario?.uso);
    if (!limite.permitido) {
      return NextResponse.json(
        { error: limite.motivo, motivo: "limite_plan" },
        { status: 403 }
      );
    }

    const refreshToken = datosUsuario?.credenciales_externas?.google_calendar_refresh_token;

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

    // Se registra recién después de que Google confirmó el evento: si la
    // sincronización falla, no le gastamos el cupo del mes al usuario.
    await adminDb
      .collection("usuarios")
      .doc(uid)
      .set({ uso: { ultima_sincronizacion_calendar: new Date().toISOString() } }, { merge: true });

    console.log(`[Calendar Sync] Evento creado: ${evento.id} para uid: ${uid}`);

    return NextResponse.json({ eventId: evento.id, htmlLink: evento.htmlLink });

  } catch (error) {
    console.error("[Calendar Sync] Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
