// src/lib/firebase-admin.ts
// SDK de Firebase Admin para uso exclusivo en API Routes (server-side)
// NUNCA importar este archivo desde componentes de React

import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  // En build-time no hay variables de entorno del servidor disponibles.
  // Retornar null para que los módulos que lo usan fallen solo en runtime.
  if (!serviceAccountKey) {
    if (process.env.NODE_ENV === "production" || process.env.NEXT_PHASE === "phase-production-server") {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY no está configurada en las variables de entorno del servidor."
      );
    }
    // Durante build estático, inicializar con config vacía (las rutas son dinámicas de todos modos)
    return initializeApp({ projectId: "monteflori-build-placeholder" });
  }

  const serviceAccount = JSON.parse(serviceAccountKey);
  return initializeApp({ credential: cert(serviceAccount) });
}

const adminApp = getAdminApp();

export const adminDb: Firestore = getFirestore(adminApp);
export const adminAuth: Auth = getAuth(adminApp);
export default adminApp;
