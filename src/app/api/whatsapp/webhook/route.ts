// src/app/api/whatsapp/webhook/route.ts
export const dynamic = "force-dynamic";
//
// FUERA DE SERVICIO — el bot de WhatsApp está desactivado.
//
// Dos motivos:
//  1. Costo: WhatsApp cobra por mensaje y desde el 1/10/2026 también cobra las
//     respuestas dentro de la ventana de 24 h, que hasta ahora eran gratis.
//     Queda en pausa hasta resolver el financiamiento (ver ESTRATEGIA.md).
//  2. Seguridad: este webhook nunca validó la firma X-Hub-Signature-256 de
//     Meta, así que cualquiera que conociera la URL podía simular ser un
//     usuario registrado y leer sus datos académicos.
//
// Responde 503 en vez de borrarse para que, si el webhook sigue configurado en
// Meta, no procese nada. La implementación anterior —incluido el parser de
// comandos (promedio, materias, parciales, esta semana, avance), que sirve para
// reusar en Telegram— está en el historial de git.
//
// Antes de reactivarlo: validar la firma de Meta y decidir el canal (Telegram
// no tiene costo por mensaje).

import { NextResponse } from "next/server";

const FUERA_DE_SERVICIO = {
  error: "El bot de WhatsApp está temporalmente fuera de servicio.",
};

export async function GET() {
  return NextResponse.json(FUERA_DE_SERVICIO, { status: 503 });
}

export async function POST() {
  return NextResponse.json(FUERA_DE_SERVICIO, { status: 503 });
}
