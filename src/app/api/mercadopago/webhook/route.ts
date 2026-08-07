// src/app/api/mercadopago/webhook/route.ts
export const dynamic = "force-dynamic";
// Recibe las notificaciones de Mercado Pago sobre el estado de las donaciones
// recurrentes y actualiza el nivel del usuario.
//
// Dos defensas importantes:
//  1. Se valida la firma HMAC del header `x-signature`: sin esto, cualquiera
//     que conociera la URL podría marcarse como donante con un POST.
//  2. No se confía en el cuerpo de la notificación para saber el estado: se
//     vuelve a consultar el preapproval a la API de Mercado Pago, que es la
//     fuente de verdad.

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";

/** Días de gracia después de la fecha del próximo cobro antes de bajar el nivel. */
const DIAS_GRACIA = 3;

const notificacionSchema = z.object({
  type: z.string().optional(),
  action: z.string().optional(),
  data: z.object({ id: z.union([z.string(), z.number()]) }).optional(),
});

const preapprovalSchema = z.object({
  id: z.string(),
  status: z.string(),
  external_reference: z.string().min(1),
  next_payment_date: z.string().optional(),
});

/**
 * Valida el header `x-signature` según el esquema de Mercado Pago:
 * el manifest firmado es `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 */
function firmaValida(request: NextRequest, dataId: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Mercado Pago] MERCADOPAGO_WEBHOOK_SECRET no configurado — se rechaza.");
    return false;
  }

  const signature = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id") ?? "";
  if (!signature) return false;

  const partes = Object.fromEntries(
    signature.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k.trim(), v.join("=").trim()];
    })
  );

  const ts = partes["ts"];
  const v1 = partes["v1"];
  if (!ts || !v1) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const esperada = createHmac("sha256", secret).update(manifest).digest("hex");

  const a = Buffer.from(v1);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  try {
    const cuerpo = notificacionSchema.safeParse(await request.json().catch(() => ({})));
    const dataId = cuerpo.success ? cuerpo.data.data?.id : undefined;

    if (!cuerpo.success || dataId === undefined) {
      // Devolvemos 200 igual: si respondemos error, Mercado Pago reintenta en loop.
      return NextResponse.json({ status: "ignorado" }, { status: 200 });
    }

    const idPreapproval = String(dataId);

    if (!firmaValida(request, idPreapproval)) {
      console.warn("[Mercado Pago] Firma inválida — notificación rechazada.");
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }

    // Solo nos interesan las notificaciones de suscripciones.
    const tipo = cuerpo.data.type ?? "";
    if (!tipo.includes("preapproval")) {
      return NextResponse.json({ status: "ignorado" }, { status: 200 });
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      console.error("[Mercado Pago] MERCADOPAGO_ACCESS_TOKEN no configurado.");
      return NextResponse.json({ status: "sin_configurar" }, { status: 200 });
    }

    // Fuente de verdad: consultamos el estado real, no el que dice la notificación.
    const respuesta = await fetch(`https://api.mercadopago.com/preapproval/${idPreapproval}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!respuesta.ok) {
      console.error("[Mercado Pago] No se pudo consultar el preapproval:", idPreapproval);
      return NextResponse.json({ status: "error_consulta" }, { status: 200 });
    }

    const datos = preapprovalSchema.safeParse(await respuesta.json());
    if (!datos.success) {
      console.error("[Mercado Pago] Respuesta inesperada al consultar preapproval.");
      return NextResponse.json({ status: "respuesta_inesperada" }, { status: 200 });
    }

    const { status, external_reference: uid, next_payment_date } = datos.data;
    const activa = status === "authorized";

    let activoHasta: string | undefined;
    if (activa) {
      const base = next_payment_date ? new Date(next_payment_date) : new Date();
      if (!next_payment_date) base.setMonth(base.getMonth() + 1);
      base.setDate(base.getDate() + DIAS_GRACIA);
      activoHasta = base.toISOString();
    }

    await adminDb
      .collection("usuarios")
      .doc(uid)
      .set(
        {
          suscripcion: {
            plan: activa ? "donante" : "gratis",
            mercadopago_preapproval_id: idPreapproval,
            ...(activoHasta ? { donante_activo_hasta: activoHasta } : {}),
          },
        },
        { merge: true }
      );

    console.log(`[Mercado Pago] Suscripción ${status} para uid: ${uid}`);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("[Mercado Pago] Error en webhook:", error);
    // 200 a propósito: un 500 hace que Mercado Pago reintente indefinidamente.
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}
