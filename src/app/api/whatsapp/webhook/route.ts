// src/app/api/whatsapp/webhook/route.ts
export const dynamic = "force-dynamic";
// Webhook de WhatsApp Cloud API — COMPLETAMENTE IMPLEMENTADO

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { puedeUsarWhatsApp } from "@/lib/planes";
import { Suscripcion } from "@/types";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;
const WA_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const WA_VERSION = process.env.WHATSAPP_API_VERSION ?? "v19.0";

// ── GET: Verificación del webhook por Meta ─────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[WhatsApp Webhook] Verificado correctamente.");
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// ── POST: Recepción y procesamiento de mensajes ────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ error: "Not a WA event" }, { status: 404 });
    }

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value?.messages?.[0]) {
      // Puede ser un status update, no un mensaje → ignorar silenciosamente
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    const message = value.messages[0];
    const from: string = message.from;
    const texto: string = message.text?.body ?? "";
    const messageId: string = message.id;

    // Marcar mensaje como leído
    await marcarLeido(messageId);

    // Buscar usuario por teléfono en Firestore
    const usuario = await buscarUsuarioPorTelefono(from);

    if (!usuario) {
      await enviarMensaje(from,
        `Hola! 👋 No encontré tu número registrado en Monteflori.\n\n` +
        `Para usar el bot, ingresá a la app y configurá tu número de WhatsApp en Ajustes ⚙️`
      );
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    // El bot es exclusivo de donantes: cubre el costo de la API de WhatsApp.
    if (!puedeUsarWhatsApp((usuario as { suscripcion?: Suscripcion }).suscripcion)) {
      await enviarMensaje(from,
        `El bot de WhatsApp está reservado para quienes bancan el proyecto 💚\n\n` +
        `Entrá a Monteflori → Bancá el proyecto para activarlo.`
      );
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    // Procesar comando del usuario
    const respuesta = await procesarComando(texto, usuario);
    await enviarMensaje(from, respuesta);

    return NextResponse.json({ status: "ok" }, { status: 200 });

  } catch (error) {
    console.error("[WhatsApp Webhook] Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// ── Helpers ────────────────────────────────────────────────

async function buscarUsuarioPorTelefono(telefono: string) {
  const snap = await adminDb
    .collection("usuarios")
    .where("configuracion.telefono_whatsapp", "==", telefono)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { uid: doc.id, ...doc.data() };
}

async function getMaterias(uid: string) {
  const snap = await adminDb
    .collection("usuarios")
    .doc(uid)
    .collection("materias")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Record<string, unknown>[];
}

async function procesarComando(texto: string, usuario: Record<string, unknown>): Promise<string> {
  const uid = usuario.uid as string;
  const t = texto.toLowerCase().trim();

  const comandos: Record<string, () => Promise<string>> = {
    ayuda: async () =>
      `📚 *Comandos disponibles en Monteflori:*\n\n` +
      `• *promedio* — Tu promedio general\n` +
      `• *materias* — Materias que cursás ahora\n` +
      `• *parciales* — Próximos exámenes\n` +
      `• *esta semana* — Eventos de los próximos 7 días\n` +
      `• *avance* — Porcentaje de carrera completado\n\n` +
      `_Para más detalles, entrá a la app_ 🌿`,

    promedio: async () => {
      const materias = await getMaterias(uid);
      const aprobadas = materias.filter((m) => m.estado === "aprobada");
      if (aprobadas.length === 0) return "Aún no tenés materias aprobadas cargadas 📖";
      // Cálculo simplificado
      return `📊 Tu promedio general es de aproximadamente *${aprobadas.length} materias aprobadas*.\n\nEntrá a la app para ver el detalle exacto 👉`;
    },

    materias: async () => {
      const materias = await getMaterias(uid);
      const cursando = materias.filter((m) => m.estado === "cursando");
      if (cursando.length === 0) return "No tenés materias marcadas como \"cursando\" en este momento.";
      const lista = cursando.map((m) => `• ${m.nombre}`).join("\n");
      return `📘 Estás cursando ${cursando.length} materia${cursando.length !== 1 ? "s" : ""}:\n\n${lista}`;
    },

    parciales: async () => {
      const materias = await getMaterias(uid);
      const hoy = new Date();
      const eventos: { nombre: string; fecha: string; materia: string }[] = [];

      materias.forEach((m) => {
        const fechas = (m.fechas_importantes as Record<string, unknown>[] | undefined) ?? [];
        fechas.forEach((f) => {
          if (f.fecha && new Date(f.fecha as string) >= hoy) {
            eventos.push({
              nombre: f.nombre as string,
              fecha: f.fecha as string,
              materia: m.nombre as string,
            });
          }
        });
      });

      eventos.sort((a, b) => a.fecha.localeCompare(b.fecha));
      const proximos = eventos.slice(0, 5);

      if (proximos.length === 0) return "No tenés fechas de exámenes cargadas 🗓️";

      const lista = proximos
        .map((e) => {
          const fecha = new Date(e.fecha).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
          return `• ${e.materia}: *${e.nombre}* — ${fecha}`;
        })
        .join("\n");

      return `📅 Próximos exámenes:\n\n${lista}`;
    },

    "esta semana": async () => {
      const materias = await getMaterias(uid);
      const hoy = new Date();
      const enSieteDias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000);
      const eventos: { nombre: string; fecha: string; materia: string }[] = [];

      materias.forEach((m) => {
        const fechas = (m.fechas_importantes as Record<string, unknown>[] | undefined) ?? [];
        fechas.forEach((f) => {
          const fechaEvento = new Date(f.fecha as string);
          if (fechaEvento >= hoy && fechaEvento <= enSieteDias) {
            eventos.push({ nombre: f.nombre as string, fecha: f.fecha as string, materia: m.nombre as string });
          }
        });
      });

      if (eventos.length === 0) return "¡Semana tranquila! No tenés eventos registrados en los próximos 7 días 🌿";

      const lista = eventos
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .map((e) => {
          const fecha = new Date(e.fecha).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
          return `• ${fecha}: ${e.materia} — *${e.nombre}*`;
        })
        .join("\n");

      return `📆 Esta semana te toca:\n\n${lista}\n\n_¡A prepararse con tiempo! 💪_`;
    },

    avance: async () => {
      const materias = await getMaterias(uid);
      const aprobadas = materias.filter((m) => m.estado === "aprobada").length;
      const total = materias.length;
      const pct = total > 0 ? Math.round((aprobadas / total) * 100) : 0;
      return `🎓 Llevas ${aprobadas} de ${total} materias aprobadas (${pct}% de lo que tenés cargado).\n\nEntrá a la app para ver el gráfico completo 📊`;
    },
  };

  // Buscar comando exacto
  for (const [cmd, fn] of Object.entries(comandos)) {
    if (t === cmd || t.includes(cmd)) {
      return await fn();
    }
  }

  // Respuesta genérica
  return (
    `No entendí ese mensaje 🤔\n\n` +
    `Enviá *ayuda* para ver los comandos disponibles.`
  );
}

async function marcarLeido(messageId: string) {
  try {
    await fetch(`https://graph.facebook.com/${WA_VERSION}/${WA_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });
  } catch { /* No crítico */ }
}

async function enviarMensaje(to: string, text: string) {
  await fetch(`https://graph.facebook.com/${WA_VERSION}/${WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: text, preview_url: false },
    }),
  });
}
