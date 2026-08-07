// src/app/api/auth/google-calendar/start/route.ts
export const dynamic = "force-dynamic";
// Arranca el flujo OAuth de Google Calendar. Se hace server-side (y no armando
// la URL en el cliente) porque el parámetro `state` va firmado con un secreto
// que no puede salir del servidor — ver src/lib/oauth-state.ts.

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { crearState } from "@/lib/oauth-state";
import { verificarRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);

    const limiteRate = verificarRateLimit(`oauth-start:${decoded.uid}`, 10, 60_000);
    if (!limiteRate.permitido) {
      return NextResponse.json(
        { error: "Demasiados intentos seguidos. Esperá un momento." },
        { status: 429, headers: { "Retry-After": String(limiteRate.reintentarEn) } }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      redirect_uri: `${baseUrl}/api/auth/callback/google-calendar`,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/calendar.events",
      access_type: "offline",
      prompt: "consent",
      state: crearState(decoded.uid),
    });

    return NextResponse.json({
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    });
  } catch (error) {
    console.error("[Google Calendar OAuth start] Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
