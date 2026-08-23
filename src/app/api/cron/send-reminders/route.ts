// src/app/api/cron/send-reminders/route.ts
export const dynamic = "force-dynamic";
// Cron Job diario para envío proactivo de recordatorios de WhatsApp
// Protegido con CRON_SECRET — configurar en Vercel Cron Jobs

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { esDonanteActivo } from "@/lib/planes";
import { Suscripcion } from "@/types";

const WA_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const WA_VERSION = process.env.WHATSAPP_API_VERSION ?? "v19.0";
const CRON_SECRET = process.env.CRON_SECRET!;

export async function GET(request: NextRequest) {
  // Verificar autorización del cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hoy = new Date();
  const mañana = new Date(hoy);
  mañana.setDate(mañana.getDate() + 1);
  const mañanaStr = mañana.toISOString().split("T")[0]; // "YYYY-MM-DD"

  // Detectar si hoy es lunes (inicio de semana)
  const esLunes = hoy.getDay() === 1;

  let enviados = 0;
  let errores = 0;
  let omitidosPorPlan = 0;

  try {
    // Obtener todos los usuarios con WhatsApp configurado y notificaciones activas
    const usuariosSnap = await adminDb
      .collection("usuarios")
      .where("configuracion.notificaciones_whatsapp", "==", true)
      .get();

    for (const usuarioDoc of usuariosSnap.docs) {
      const uid = usuarioDoc.id;
      const userData = usuarioDoc.data();
      const telefono = userData.configuracion?.telefono_whatsapp;

      if (!telefono) continue;

      // Cada mensaje que sale de acá es un template iniciado por nosotros: la
      // categoría más cara de WhatsApp, y que nunca fue gratis (lo gratuito era
      // responder dentro de la ventana de 24 h, y desde el 1/10/2026 tampoco).
      // Sin este chequeo, cualquiera que active las notificaciones nos genera
      // un gasto diario. WhatsApp es exclusivo de donantes.
      if (!esDonanteActivo(userData.suscripcion as Suscripcion | undefined, hoy)) {
        omitidosPorPlan++;
        continue;
      }

      // Obtener materias del usuario
      const materiasSnap = await adminDb
        .collection("usuarios")
        .doc(uid)
        .collection("materias")
        .get();

      const materias = materiasSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Buscar eventos para mañana
      const eventosMañana: { materia: string; nombre: string; tipo: string }[] = [];
      const eventosSemana: { materia: string; nombre: string; fecha: string }[] = [];

      const enSieteDias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000);

      materias.forEach((m: Record<string, unknown>) => {
        const fechas = (m.fechas_importantes as Record<string, unknown>[] | undefined) ?? [];
        fechas.forEach((f: Record<string, unknown>) => {
          const fechaStr = f.fecha as string;
          if (!fechaStr) return;

          // Eventos de mañana
          if (fechaStr.startsWith(mañanaStr)) {
            eventosMañana.push({
              materia: m.nombre as string,
              nombre: f.nombre as string,
              tipo: f.tipo as string,
            });
          }

          // Eventos de la semana (solo el lunes)
          if (esLunes) {
            const fechaEvento = new Date(fechaStr);
            if (fechaEvento >= hoy && fechaEvento <= enSieteDias) {
              eventosSemana.push({
                materia: m.nombre as string,
                nombre: f.nombre as string,
                fecha: fechaStr,
              });
            }
          }
        });
      });

      // Enviar recordatorio de mañana
      if (eventosMañana.length > 0) {
        try {
          const nombreUsuario = userData.perfil?.nombre?.split(" ")?.[0] ?? "Estudiante";
          const lista = eventosMañana
            .map((e) => `• ${e.materia}: ${e.nombre}`)
            .join("\n");

          // ⚠️ IMPORTANTE: En producción, aquí se usa un Template aprobado por Meta.
          // Mientras lo aprobás, puedes usar texto libre solo si el usuario te escribió en las últimas 24h.
          // Template de ejemplo: "recordatorio_examen_manana"
          await enviarTemplate(telefono, "recordatorio_examen_manana", [
            nombreUsuario,
            lista,
          ]);

          enviados++;
        } catch {
          errores++;
        }
      }

      // Enviar resumen semanal (lunes)
      if (esLunes && eventosSemana.length > 0) {
        try {
          const nombreUsuario = userData.perfil?.nombre?.split(" ")?.[0] ?? "Estudiante";
          const lista = eventosSemana
            .map((e) => {
              const fecha = new Date(e.fecha).toLocaleDateString("es-AR", {
                weekday: "short", day: "numeric", month: "short"
              });
              return `• ${fecha}: ${e.materia} — ${e.nombre}`;
            })
            .join("\n");

          await enviarTemplate(telefono, "resumen_semanal", [
            nombreUsuario,
            String(eventosSemana.length),
            lista,
          ]);

          enviados++;
        } catch {
          errores++;
        }
      }
    }

    console.log(
      `[Cron] Recordatorios enviados: ${enviados}, errores: ${errores}, omitidos por plan: ${omitidosPorPlan}`
    );
    return NextResponse.json({
      enviados,
      errores,
      omitidos_por_plan: omitidosPorPlan,
      timestamp: hoy.toISOString(),
    });

  } catch (error) {
    console.error("[Cron] Error fatal:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

/**
 * Envía un template de mensaje aprobado por Meta.
 * Los templates deben estar creados y aprobados en WhatsApp Business Manager.
 *
 * Pasos para crearlos:
 * 1. Ir a business.facebook.com → Administrador de WhatsApp → Plantillas de mensajes
 * 2. Crear la plantilla con las variables {{1}}, {{2}}, etc.
 * 3. Esperar aprobación (24-48h)
 */
async function enviarTemplate(
  to: string,
  templateName: string,
  variables: string[]
) {
  const components = variables.length > 0
    ? [{
      type: "body",
      parameters: variables.map((v) => ({ type: "text", text: v })),
    }]
    : [];

  const response = await fetch(
    `https://graph.facebook.com/${WA_VERSION}/${WA_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: "es_AR" },
          components,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Template error: ${JSON.stringify(err)}`);
  }
}
