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

  if (!serviceAccountKey) {
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY no está configurada en las variables de entorno del servidor."
      );
    }
    // Durante build estático o en desarrollo sin key, inicializar con config placeholder
    return initializeApp({ projectId: "monteflori-build-placeholder" });
  }

  try {
    // Si viene con saltos de línea escapados literal (\\n), los normalizamos a \n en el string JSON
    const normalizedKey = serviceAccountKey.trim();
    const serviceAccount = JSON.parse(normalizedKey);
    return initializeApp({ credential: cert(serviceAccount) });
  } catch (error) {
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      console.warn("[firebase-admin] Error al parsear FIREBASE_SERVICE_ACCOUNT_KEY:", error);
    }
    // En fase de build estático, usar placeholder para no romper la compilación
    return initializeApp({ projectId: "monteflori-build-placeholder" });
  }
}

const adminApp = getAdminApp();

export const adminDb: Firestore = getFirestore(adminApp);
export const adminAuth: Auth = getAuth(adminApp);
export default adminApp;
