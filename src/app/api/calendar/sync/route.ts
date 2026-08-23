// src/app/api/calendar/sync/route.ts
export const dynamic = "force-dynamic";
// Sincroniza las fechas importantes del usuario con su Google Calendar.
//
// Es idempotente: compara contra lo ya sincronizado (uso.calendar_eventos) y
// solo llama a la API de Google por lo que cambió. Llamarla dos veces seguidas
// sin haber tocado nada no hace ninguna llamada ni crea eventos duplicados.
//
// Se dispara por evento desde el cliente (al agregar/editar/borrar una fecha o
// al importar de SIU) y una vez por día como repaso al abrir la app. No hay
// ningún proceso en segundo plano usando el token del usuario.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { verificarRateLimit } from "@/lib/rate-limit";
import {
  planificarSync,
  planVacio,
  hashFecha,
  tituloEvento,
  descripcionEvento,
  FechaSincronizable,
  MapaEventos,
} from "@/lib/calendar-sync";
import { ErrorCalendar } from "@/types";

const bodySchema = z
  .object({
    /** Si viene, es una reconciliación completa (repaso diario). */
    reconciliacion: z.boolean().optional(),
  })
  .optional();

const ZONA = "America/Argentina/Buenos_Aires";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** Error que ya trae el mensaje redactado para mostrarle al usuario. */
class ErrorSync extends Error {
  requiereReconectar: boolean;
  constructor(mensaje: string, requiereReconectar = false) {
    super(mensaje);
    this.requiereReconectar = requiereReconectar;
  }
}

export async function POST(request: NextRequest) {
  let uid: string | null = null;

  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    uid = decoded.uid;

    const limiteRate = verificarRateLimit(`calendar:${uid}`, 20, 60_000);
    if (!limiteRate.permitido) {
      return NextResponse.json(
        { error: `Demasiadas sincronizaciones seguidas. Probá en ${limiteRate.reintentarEn} segundos.` },
        { status: 429, headers: { "Retry-After": String(limiteRate.reintentarEn) } }
      );
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    const esReconciliacion = parsed.success ? parsed.data?.reconciliacion === true : false;

    const usuarioRef = adminDb.collection("usuarios").doc(uid);
    const usuarioDoc = await usuarioRef.get();
    const datosUsuario = usuarioDoc.data();

    const refreshToken = datosUsuario?.credenciales_externas?.google_calendar_refresh_token;
    if (!refreshToken) {
      // No es un error a mostrar: simplemente no conectó Calendar. La app llama
      // a esta ruta para todos, así que responder 200 evita ruido inútil.
      return NextResponse.json({ conectado: false, sincronizados: 0 });
    }

    // ── Armar el estado actual a partir de las materias ──
    const materiasSnap = await usuarioRef.collection("materias").get();
    const fechas: FechaSincronizable[] = [];

    materiasSnap.docs.forEach((doc) => {
      const materia = doc.data();
      const nombreMateria = (materia.nombre as string) ?? "Materia";
      const importantes = (materia.fechas_importantes ?? []) as Record<string, unknown>[];

      importantes.forEach((f) => {
        const fechaStr = f.fecha as string | undefined;
        // Sin fecha parseable no se puede crear un evento.
        if (!fechaStr || Number.isNaN(Date.parse(fechaStr))) return;
        fechas.push({
          id: String(f.id ?? ""),
          nombre: (f.nombre as string) ?? "Evento",
          fecha: fechaStr,
          tipo: (f.tipo as string) ?? "otro",
          materiaNombre: nombreMateria,
        });
      });
    });

    const yaSincronizado: MapaEventos = datosUsuario?.uso?.calendar_eventos ?? {};
    const plan = planificarSync(fechas, yaSincronizado);

    // Nada que hacer: ni siquiera pedimos un access token.
    if (planVacio(plan)) {
      await limpiarError(usuarioRef, datosUsuario?.uso?.calendar_ultimo_error, esReconciliacion);
      return NextResponse.json({
        conectado: true,
        creados: 0,
        actualizados: 0,
        eliminados: 0,
        sin_cambios: plan.sinCambios,
      });
    }

    const accessToken = await obtenerAccessToken(refreshToken);
    const mapaNuevo: MapaEventos = { ...yaSincronizado };

    // ── Crear ──
    for (const fecha of plan.crear) {
      const evento = await llamarGoogle(accessToken, CALENDAR_API, "POST", cuerpoEvento(fecha));
      if (evento?.id) {
        mapaNuevo[fecha.id] = { eventId: evento.id, hash: hashFecha(fecha) };
      }
    }

    // ── Actualizar ──
    for (const { fecha, eventId } of plan.actualizar) {
      const url = `${CALENDAR_API}/${encodeURIComponent(eventId)}`;
      const evento = await llamarGoogle(accessToken, url, "PATCH", cuerpoEvento(fecha), true);

      if (evento === null) {
        // El usuario borró el evento desde Google: lo recreamos.
        const recreado = await llamarGoogle(accessToken, CALENDAR_API, "POST", cuerpoEvento(fecha));
        if (recreado?.id) {
          mapaNuevo[fecha.id] = { eventId: recreado.id, hash: hashFecha(fecha) };
        }
      } else {
        mapaNuevo[fecha.id] = { eventId, hash: hashFecha(fecha) };
      }
    }

    // ── Eliminar ──
    for (const { fechaId, eventId } of plan.eliminar) {
      const url = `${CALENDAR_API}/${encodeURIComponent(eventId)}`;
      // Si ya no existe en Google, damos la baja por buena igual.
      await llamarGoogle(accessToken, url, "DELETE", undefined, true);
      delete mapaNuevo[fechaId];
    }

    const uso: Record<string, unknown> = {
      calendar_eventos: mapaNuevo,
      calendar_ultimo_error: null,
    };
    if (esReconciliacion) uso.ultima_reconciliacion_calendar = new Date().toISOString();

    await usuarioRef.set({ uso }, { merge: true });

    console.log(
      `[Calendar Sync] uid=${uid} creados=${plan.crear.length} ` +
        `actualizados=${plan.actualizar.length} eliminados=${plan.eliminar.length}`
    );

    return NextResponse.json({
      conectado: true,
      creados: plan.crear.length,
      actualizados: plan.actualizar.length,
      eliminados: plan.eliminar.length,
      sin_cambios: plan.sinCambios,
    });
  } catch (error) {
    const esConocido = error instanceof ErrorSync;
    const mensaje = esConocido
      ? error.message
      : "No se pudieron sincronizar tus fechas con Google Calendar.";
    const requiereReconectar = esConocido ? error.requiereReconectar : false;

    if (!esConocido) console.error("[Calendar Sync] Error:", error);

    // Se deja registrado para poder avisarle al usuario la próxima vez que
    // entre, aunque el fallo haya ocurrido en una sincronización silenciosa.
    if (uid) {
      const registro: ErrorCalendar = {
        mensaje,
        fecha: new Date().toISOString(),
        requiere_reconectar: requiereReconectar,
      };
      await adminDb
        .collection("usuarios")
        .doc(uid)
        .set({ uso: { calendar_ultimo_error: registro } }, { merge: true })
        .catch(() => {});
    }

    return NextResponse.json({ error: mensaje, requiere_reconectar: requiereReconectar }, { status: 500 });
  }
}

/** Borra el error guardado cuando la sincronización vuelve a funcionar. */
async function limpiarError(
  usuarioRef: FirebaseFirestore.DocumentReference,
  errorPrevio: unknown,
  esReconciliacion: boolean
) {
  const cambios: Record<string, unknown> = {};
  if (errorPrevio) cambios.calendar_ultimo_error = null;
  if (esReconciliacion) cambios.ultima_reconciliacion_calendar = new Date().toISOString();
  if (Object.keys(cambios).length === 0) return;
  await usuarioRef.set({ uso: cambios }, { merge: true });
}

async function obtenerAccessToken(refreshToken: string): Promise<string> {
  const respuesta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const datos = await respuesta.json();

  if (!datos.access_token) {
    // invalid_grant = el usuario revocó el permiso desde su cuenta de Google,
    // o el token caducó. No se arregla reintentando: hay que reconectar.
    const revocado = datos.error === "invalid_grant";
    throw new ErrorSync(
      revocado
        ? "Se cortó el permiso con Google Calendar. Volvé a conectarlo para seguir sincronizando."
        : "No se pudo renovar el acceso a Google Calendar.",
      revocado
    );
  }

  return datos.access_token as string;
}

/**
 * Llama a la API de Calendar. Si `tolerarNoExiste`, un 404/410 devuelve null en
 * vez de tirar error — es el caso de un evento que el usuario ya borró a mano.
 */
async function llamarGoogle(
  accessToken: string,
  url: string,
  metodo: "POST" | "PATCH" | "DELETE",
  cuerpo?: unknown,
  tolerarNoExiste = false
): Promise<{ id?: string } | null> {
  const respuesta = await fetch(url, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

  if (respuesta.ok) {
    if (metodo === "DELETE") return null;
    return respuesta.json();
  }

  if (tolerarNoExiste && (respuesta.status === 404 || respuesta.status === 410)) {
    return null;
  }

  const detalle = await respuesta.text().catch(() => "");
  console.error(`[Calendar Sync] Google ${metodo} ${respuesta.status}:`, detalle);

  if (respuesta.status === 401 || respuesta.status === 403) {
    throw new ErrorSync(
      "Google rechazó el acceso a tu calendario. Probá reconectando la cuenta.",
      true
    );
  }

  throw new ErrorSync("Google Calendar no respondió como esperábamos. Probá de nuevo en un rato.");
}

function cuerpoEvento(fecha: FechaSincronizable) {
  const inicio = new Date(fecha.fecha);
  const fin = new Date(inicio.getTime() + 2 * 60 * 60 * 1000);

  return {
    summary: tituloEvento(fecha),
    description: descripcionEvento(fecha),
    start: { dateTime: inicio.toISOString(), timeZone: ZONA },
    end: { dateTime: fin.toISOString(), timeZone: ZONA },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 60 * 24 },
        { method: "popup", minutes: 60 },
      ],
    },
    colorId: "3",
  };
}
