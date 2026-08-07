// src/app/api/mercadopago/crear-suscripcion/route.ts
export const dynamic = "force-dynamic";
// Crea una suscripción recurrente ("preapproval") en Mercado Pago para el usuario
// autenticado y devuelve el link de checkout. El uid viaja como external_reference
// para que el webhook sepa después a quién acreditarle la donación.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth } from "@/lib/firebase-admin";
import { DONACION_MINIMA_ARS } from "@/lib/planes";

const bodySchema = z.object({
  // El usuario puede donar más que el mínimo, pero nunca menos.
  monto: z.number().min(DONACION_MINIMA_ARS).max(1_000_000).optional(),
});

const respuestaMPSchema = z.object({
  id: z.string(),
  init_point: z.string().url(),
});

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      console.error("[Mercado Pago] MERCADOPAGO_ACCESS_TOKEN no configurado.");
      return NextResponse.json(
        { error: "Las donaciones todavía no están habilitadas." },
        { status: 503 }
      );
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: `El monto mínimo es de $${DONACION_MINIMA_ARS} ARS.` },
        { status: 400 }
      );
    }

    const monto = parsed.data.monto ?? DONACION_MINIMA_ARS;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const respuesta = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason: "Donación mensual a Monteflori",
        external_reference: decoded.uid,
        payer_email: decoded.email,
        back_url: `${baseUrl}/donar?estado=volviendo`,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: monto,
          currency_id: "ARS",
        },
      }),
    });

    if (!respuesta.ok) {
      console.error("[Mercado Pago] Error al crear preapproval:", await respuesta.text());
      return NextResponse.json(
        { error: "No se pudo iniciar la donación. Intentá de nuevo." },
        { status: 502 }
      );
    }

    const datos = respuestaMPSchema.safeParse(await respuesta.json());
    if (!datos.success) {
      console.error("[Mercado Pago] Respuesta inesperada al crear preapproval.");
      return NextResponse.json({ error: "Respuesta inesperada de Mercado Pago." }, { status: 502 });
    }

    return NextResponse.json({ url: datos.data.init_point });
  } catch (error) {
    console.error("[Mercado Pago] Error al crear suscripción:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
