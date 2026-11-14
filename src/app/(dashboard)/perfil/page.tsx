"use client";

// src/app/(dashboard)/perfil/page.tsx
// Datos personales del usuario: foto, nombre, apodo, facultad y contraseña.
// Lo que es de la app (tema, Calendar, extensión) vive en Configuración.

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateProfile, sendPasswordResetEmail, signOut } from "firebase/auth";
import { Camera, ChevronRight, KeyRound, LogOut, Settings } from "lucide-react";
import { auth } from "@/lib/firebase";
import { updatePerfil } from "@/lib/firestore";
import { uploadAvatar } from "@/lib/storage";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { usePerfil } from "@/hooks/usePerfil";
import { useToast } from "@/components/ui/Feedback";
import { Avatar, Campo, Esqueleto, PageHeader, Spinner } from "@/components/ui/kit";
import { Perfil } from "@/types";

export default function PerfilPage() {
  const { user } = useAuthContext();
  const { perfil, loading } = usePerfil();
  const router = useRouter();
  const toast = useToast();

  const [enviandoReset, setEnviandoReset] = useState(false);
  const [resetEnviado, setResetEnviado] = useState(false);

  if (!user) return null;

  const datos = perfil?.perfil;
  const nombre = datos?.nombre || user.displayName || "";
  const email = datos?.email || user.email || "";
  const conPassword = user.providerData.some((p) => p.providerId === "password");
  const desde = datos?.fecha_creacion
    ? new Date(datos.fecha_creacion).toLocaleDateString("es-AR", { month: "long", year: "numeric" })
    : null;

  async function enviarReset() {
    if (!email) return;
    setEnviandoReset(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetEnviado(true);
      toast("Te mandamos un email para cambiarla");
    } catch {
      toast("No se pudo enviar el email. Probá en unos minutos.", "error");
    } finally {
      setEnviandoReset(false);
    }
  }

  async function cerrarSesion() {
    await signOut(auth);
    router.replace("/login");
  }

  return (
    <main className="page page-narrow space-y-4">
      <PageHeader titulo="Mi perfil" />

      <section className="card card-pad !mt-0 flex items-center gap-4">
        <FotoPerfil uid={user.uid} nombre={nombre} url={datos?.avatar_url || user.photoURL} />
        <div className="min-w-0">
          <p className="font-display text-xl font-semibold text-foreground truncate">{nombre || "Estudiante"}</p>
          <p className="text-sm text-foreground-muted truncate">{email}</p>
          {desde && <p className="text-xs text-foreground-subtle mt-0.5">En Monteflori desde {desde}</p>}
        </div>
      </section>

      {loading ? (
        <Esqueleto filas={1} alto="h-72" />
      ) : (
        // key: el formulario arranca con lo guardado y no se pisa mientras se escribe.
        <DatosPersonales key={user.uid} uid={user.uid} inicial={{ ...datos, nombre }} />
      )}

      <section className="card card-pad">
        <h2 className="section-title flex items-center gap-2 mb-3">
          <KeyRound size={17} className="text-accent" /> Contraseña
        </h2>
        {conPassword ? (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-foreground-muted flex-1 min-w-48">
              {resetEnviado
                ? `Listo. Revisá ${email} (mirá también en spam).`
                : "Te mandamos un email con un link para elegir una nueva."}
            </p>
            <button id="btn-cambiar-password" type="button" className="btn btn-secondary" onClick={enviarReset}
              disabled={enviandoReset || resetEnviado}>
              {enviandoReset && <Spinner size={14} />}
              {resetEnviado ? "Email enviado" : "Cambiar contraseña"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-foreground-muted">
            Entrás con tu cuenta de Google, así que no hay contraseña de Monteflori para cambiar.
          </p>
        )}
      </section>

      <section className="card overflow-hidden divide-y divide-card-border">
        <Link href="/configuracion" className="row-hover flex items-center gap-3 px-5 py-4 text-sm font-bold text-foreground">
          <Settings size={17} className="text-foreground-muted" />
          <span className="flex-1">Configuración de la app</span>
          <ChevronRight size={16} className="text-foreground-subtle" />
        </Link>
        <button id="btn-cerrar-sesion-perfil" type="button" onClick={cerrarSesion}
          className="row-hover w-full flex items-center gap-3 px-5 py-4 text-sm font-bold text-alert text-left">
          <LogOut size={17} /> Cerrar sesión
        </button>
      </section>
    </main>
  );
}

// ── Datos personales: un solo formulario con un solo botón de guardar ───────

function DatosPersonales({ uid, inicial }: { uid: string; inicial: Partial<Perfil> }) {
  const toast = useToast();
  const [nombre, setNombre] = useState(inicial.nombre ?? "");
  const [alias, setAlias] = useState(inicial.alias ?? "");
  const [universidad, setUniversidad] = useState(inicial.universidad ?? "");
  const [bio, setBio] = useState(inicial.bio ?? "");
  const [guardado, setGuardado] = useState({
    nombre: inicial.nombre ?? "",
    alias: inicial.alias ?? "",
    universidad: inicial.universidad ?? "",
    bio: inicial.bio ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actual = { nombre: nombre.trim(), alias: alias.trim(), universidad: universidad.trim(), bio: bio.trim() };
  const hayCambios = (Object.keys(actual) as (keyof typeof actual)[]).some((k) => actual[k] !== guardado[k]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!actual.nombre) { setError("El nombre no puede quedar vacío."); return; }
    setError(null);
    setGuardando(true);
    try {
      await updatePerfil(uid, actual);
      if (auth.currentUser && actual.nombre !== guardado.nombre) {
        await updateProfile(auth.currentUser, { displayName: actual.nombre });
      }
      setGuardado(actual);
      toast("Perfil guardado");
    } catch {
      setError("No se pudo guardar. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card card-pad space-y-4" noValidate>
      <h2 className="section-title">Tus datos</h2>
      {error && <div className="notice notice-error" role="alert">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo label="Nombre y apellido" htmlFor="perfil-nombre">
          <input id="perfil-nombre" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)}
            maxLength={200} autoComplete="name" />
        </Campo>
        <Campo label="Apodo" htmlFor="perfil-alias" opcional
          ayuda="Así te saludamos y así firmás tus comentarios. Una sola palabra.">
          <input id="perfil-alias" className="input" value={alias}
            onChange={(e) => setAlias(e.target.value.replace(/\s+/g, ""))} maxLength={20} placeholder="Ej: Flor" />
        </Campo>
      </div>

      <Campo label="Facultad o universidad" htmlFor="perfil-universidad" opcional>
        <input id="perfil-universidad" className="input" value={universidad} onChange={(e) => setUniversidad(e.target.value)}
          maxLength={200} placeholder="Ej: UTN, UBA, UNC..." />
      </Campo>

      <Campo label="Sobre vos" htmlFor="perfil-bio" opcional
        ayuda={<span className="tabular">{bio.length}/300</span>}>
        <textarea id="perfil-bio" className="input" rows={3} value={bio} onChange={(e) => setBio(e.target.value)}
          maxLength={300} placeholder="Qué estudiás, qué te gusta, a dónde querés llegar..." />
      </Campo>

      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={!hayCambios || guardando}>
          {guardando && <Spinner size={14} />}
          {guardando ? "Guardando..." : hayCambios ? "Guardar cambios" : "Todo guardado"}
        </button>
      </div>
    </form>
  );
}

// ── Foto de perfil ──────────────────────────────────────────

function FotoPerfil({ uid, nombre, url }: { uid: string; nombre: string; url?: string | null }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast("La imagen tiene que pesar menos de 5 MB", "error");
      return;
    }
    const local = URL.createObjectURL(file);
    setPreview(local);
    setSubiendo(true);
    try {
      const nueva = await uploadAvatar(uid, file);
      if (auth.currentUser) await updateProfile(auth.currentUser, { photoURL: nueva });
      await updatePerfil(uid, { avatar_url: nueva });
      toast("Foto actualizada");
    } catch {
      toast("No se pudo subir la foto. Probá con otra imagen.", "error");
    } finally {
      setPreview(null);
      setSubiendo(false);
      URL.revokeObjectURL(local);
    }
  }

  return (
    <div className="relative flex-shrink-0">
      <Avatar nombre={nombre} url={preview ?? url} size={76} />
      {subiendo && (
        <span className="absolute inset-0 rounded-full flex items-center justify-center text-white" style={{ background: "rgba(0,0,0,0.5)" }}>
          <Spinner size={22} />
        </span>
      )}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={subiendo}
        className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-fg flex items-center justify-center border-2 border-card transition-transform hover:scale-110"
        aria-label="Cambiar foto de perfil"
        title="Cambiar foto"
      >
        <Camera size={14} />
      </button>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
    </div>
  );
}
