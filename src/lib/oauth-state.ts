// src/lib/oauth-state.ts
// Firma y verificación del parámetro `state` del flujo OAuth de Google Calendar.
// SOLO server-side: usa un secreto que nunca debe llegar al cliente.
//
// Cumple dos funciones:
//  1. Anti-CSRF: sin esto, cualquiera podría completar el consentimiento de Google
//     y disparar el callback para vincular su cuenta de Google con otra cuenta.
//  2. Identidad: lleva el uid firmado, así el callback sabe a qué usuario vincular
//     el refresh_token sin tener que adivinarlo buscando por email.

import { createHmac, timingSafeEqual } from "crypto";

/** Ventana de validez del state: el usuario tiene que completar el flow en este tiempo. */
const VENTANA_MS = 10 * 60 * 1000; // 10 minutos

function getSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) {
    // Fallar ruidosamente: seguir sin firma anularía el control de seguridad.
    throw new Error(
      "OAUTH_STATE_SECRET no está configurada. Es necesaria para el flujo OAuth de Google Calendar."
    );
  }
  return secret;
}

function firmar(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

/** Genera un state firmado que ata el flujo OAuth a un usuario y a un momento. */
export function crearState(uid: string): string {
  const payload = `${uid}.${Date.now()}`;
  return `${Buffer.from(payload).toString("base64url")}.${firmar(payload)}`;
}

/**
 * Verifica el state recibido en el callback. Devuelve el uid si es válido y
 * está dentro de la ventana de tiempo, o null en cualquier otro caso.
 */
export function verificarState(state: string | null): string | null {
  if (!state) return null;

  const [payloadB64, firmaRecibida] = state.split(".");
  if (!payloadB64 || !firmaRecibida) return null;

  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString();
  } catch {
    return null;
  }

  const firmaEsperada = firmar(payload);
  const a = Buffer.from(firmaRecibida);
  const b = Buffer.from(firmaEsperada);
  // timingSafeEqual explota si difieren en largo, así que lo chequeamos antes.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const separador = payload.lastIndexOf(".");
  if (separador === -1) return null;

  const uid = payload.slice(0, separador);
  const emitidoEn = Number(payload.slice(separador + 1));
  if (!uid || !Number.isFinite(emitidoEn)) return null;
  if (Date.now() - emitidoEn > VENTANA_MS) return null;

  return uid;
}
