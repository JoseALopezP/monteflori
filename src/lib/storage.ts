// src/lib/storage.ts
// Helper para subir archivos a Firebase Storage (client-side)

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

/**
 * Sube una imagen de avatar para el usuario y retorna la URL de descarga.
 * La imagen se almacena en: avatars/{uid}/avatar.{ext}
 */
export async function uploadAvatar(uid: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const storageRef = ref(storage, `avatars/${uid}/avatar.${ext}`);

  // Subir el archivo
  await uploadBytes(storageRef, file, {
    contentType: file.type,
    cacheControl: "public,max-age=3600",
  });

  // Obtener URL pública de descarga
  const url = await getDownloadURL(storageRef);
  return url;
}
