// src/lib/admin.ts
// Quién puede moderar.
//
// La lista sale de una variable de entorno y NO de un campo en la base: un
// campo sería una superficie más que proteger, y si algún día se filtrara la
// escritura, alguien podría hacerse admin solo. Con env var, cambiar quién
// modera requiere acceso al panel de Vercel.

/** UIDs con permiso de moderación, desde ADMIN_UIDS (separados por coma). */
export function obtenerAdminUids(valor = process.env.ADMIN_UIDS): string[] {
  return (valor ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function esAdmin(uid: string, valor = process.env.ADMIN_UIDS): boolean {
  if (!uid) return false;
  return obtenerAdminUids(valor).includes(uid);
}
