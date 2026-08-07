// src/lib/firebase.ts
// Inicialización del SDK de Firebase (client-side)
// Usar variables NEXT_PUBLIC_ para que sean accesibles en el navegador

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { initializeFirestore, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Patrón singleton: evitar múltiples inicializaciones en hot-reload de Next.js
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// App Check: hace que Firebase solo acepte pedidos que vengan de esta app.
// Sin esto, la API key pública (que por diseño es visible en el navegador)
// permite pegarle a Firestore desde cualquier script externo.
// Si no está configurada la site key, no se inicializa y todo sigue funcionando
// igual — así el desarrollo local no depende de tener reCAPTCHA configurado.
if (typeof window !== "undefined") {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (siteKey) {
    // En desarrollo, Firebase imprime un token de debug en la consola que hay
    // que registrar una vez en Firebase Console para no ser bloqueado.
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean })
        .FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (error) {
      // Un fallo acá no debe dejar la app inutilizable (ej. doble init en hot-reload).
      console.warn("[Firebase] No se pudo inicializar App Check:", error);
    }
  }
}

export const auth = getAuth(app);

// initializeFirestore (en vez de getFirestore) para poder pasar
// ignoreUndefinedProperties: los formularios del dashboard mandan `undefined`
// en campos opcionales vacíos, y el SDK de Firestore rechaza esos writes por defecto.
// Solo puede llamarse una vez por app, así que en hot-reload caemos a getFirestore.
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, { ignoreUndefinedProperties: true });
} catch {
  firestoreDb = getFirestore(app);
}
export const db = firestoreDb;

export const storage = getStorage(app);
export default app;
