// src/lib/firebase.ts
// Inicialización del SDK de Firebase (client-side)
// Usar variables NEXT_PUBLIC_ para que sean accesibles en el navegador

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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
