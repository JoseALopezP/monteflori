// src/app/api/cron/send-reminders/route.ts
export const dynamic = "force-dynamic";
//
// FUERA DE SERVICIO — junto con el bot de WhatsApp (ver
// src/app/api/whatsapp/webhook/route.ts).
//
// Este cron mandaba templates iniciados por nosotros, que son la categoría más
// cara de WhatsApp y nunca fueron gratis. La entrada correspondiente se sacó de
// vercel.json, así que ya no se programa; el endpoint queda respondiendo 503
// por si algo le sigue pegando.
//
// La lógica de armar los recordatorios (eventos de mañana, resumen de los
// lunes) está en el historial de git y sirve para reusar en Telegram, que no
// cobra por mensaje.

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Los recordatorios automáticos están temporalmente fuera de servicio." },
    { status: 503 }
  );
}
