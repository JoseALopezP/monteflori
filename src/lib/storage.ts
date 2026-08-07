// src/lib/storage.ts
// Helper para subir archivos a Firebase Storage (client-side)

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

/**
 * Sube una imagen de avatar para el usuario y retorna la URL de descarga.
 * La imagen se almacena SIEMPRE en la misma ruta: avatars/{uid}/avatar
 *
 * El nombre es fijo a propósito: antes se derivaba de la extensión del archivo
 * subido, así que renombrando el archivo (a.png, b.png, ...) se podían acumular
 * archivos de 5 MB sin límite en la cuenta. Con una ruta única, cada subida
 * pisa la anterior. El tipo real se guarda en contentType.
 */
export async function uploadAvatar(uid: string, file: File): Promise<string> {
  const storageRef = ref(storage, `avatars/${uid}/avatar`);

  // Subir el archivo
  await uploadBytes(storageRef, file, {
    contentType: file.type,
    cacheControl: "public,max-age=3600",
  });

  // Obtener URL pública de descarga
  const url = await getDownloadURL(storageRef);
  return url;
}
