"use client";

// src/app/(dashboard)/perfil/page.tsx
// Página completa de administración del perfil del usuario

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateProfile, sendPasswordResetEmail, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getPerfilUsuario, updatePerfil } from "@/lib/firestore";
import { uploadAvatar } from "@/lib/storage";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useMaterias } from "@/hooks/useMaterias";
import { calcularPromedioGeneral, calcularPorcentajeAvance } from "@/lib/calculo-notas";
import { useCarreras } from "@/hooks/useCarreras";
import { Usuario } from "@/types";
import {
  User, Mail, GraduationCap, Calendar, Edit3, Check, X,
  Camera, Loader2, ArrowLeft, KeyRound, LogOut,
  BookOpen, Award, TrendingUp, Clock, ChevronRight
} from "lucide-react";

// ── Componente de campo editable ────────────────────────────────────────────

interface CampoEditableProps {
  label: string;
  valor: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  onSave: (value: string) => Promise<void>;
  icon?: React.ReactNode;
  readOnly?: boolean;
}

function CampoEditable({
  label, valor, placeholder, multiline, maxLength, onSave, icon, readOnly
}: CampoEditableProps) {
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState(valor);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  // Sync con prop externa
  useEffect(() => { setDraft(valor); }, [valor]);

  async function handleSave() {
    if (draft.trim() === valor.trim()) { setEditando(false); return; }
    setGuardando(true);
    try {
      await onSave(draft.trim());
      setOk(true);
      setTimeout(() => setOk(false), 2000);
    } finally {
      setGuardando(false);
      setEditando(false);
    }
  }

  function handleCancel() {
    setDraft(valor);
    setEditando(false);
  }

  const baseInput = {
    background: "var(--background-alt)",
    border: "1.5px solid var(--color-primary)",
    color: "var(--foreground)",
    outline: "none",
    borderRadius: "var(--radius-md)",
    padding: "0.625rem 0.875rem",
    fontSize: "var(--font-size-sm)",
    width: "100%",
    resize: "none" as const,
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
          style={{ color: "var(--foreground-muted)" }}>
          {icon}
          {label}
        </label>
        {!readOnly && !editando && (
          <button
            onClick={() => setEditando(true)}
            className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg transition-all hover:opacity-75"
            style={{ color: "var(--color-primary)", background: "var(--background-alt)" }}
          >
            <Edit3 size={12} />
            Editar
          </button>
        )}
        {ok && (
          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--color-success)" }}>
            <Check size={12} /> Guardado
          </span>
        )}
      </div>

      {editando ? (
        <div className="flex flex-col gap-2">
          {multiline ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              maxLength={maxLength}
              rows={3}
              autoFocus
              style={baseInput}
            />
          ) : (
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              maxLength={maxLength}
              autoFocus
              style={baseInput}
            />
          )}
          {maxLength && (
            <p className="text-xs text-right" style={{ color: "var(--foreground-subtle)" }}>
              {draft.length}/{maxLength}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={guardando}
              className="flex-1 py-2 rounded-xl font-bold text-xs transition-all hover:opacity-90 flex items-center justify-center gap-1"
              style={{ background: "var(--color-primary)", color: "white" }}
            >
              {guardando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {guardando ? "Guardando..." : "Guardar"}
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 py-2 rounded-xl font-semibold text-xs border transition-all hover:opacity-75"
              style={{ borderColor: "var(--color-card-border)", color: "var(--foreground-muted)" }}
            >
              <X size={12} className="inline mr-1" />
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div
          className="px-3.5 py-3 rounded-xl text-sm"
          style={{
            background: "var(--background-alt)",
            border: "1.5px solid var(--color-card-border)",
            color: valor ? "var(--foreground)" : "var(--foreground-subtle)",
            minHeight: multiline ? "4rem" : "auto",
            whiteSpace: multiline ? "pre-wrap" : "normal",
          }}
        >
          {valor || placeholder || "—"}
        </div>
      )}
    </div>
  );
}

// ── Componente Avatar con upload ─────────────────────────────────────────────

interface AvatarUploadProps {
  uid: string;
  displayName: string;
  currentUrl?: string;
  onUploaded: (url: string) => void;
}

function AvatarUpload({ uid, displayName, currentUrl, onUploaded }: AvatarUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);

  useEffect(() => { setPreview(currentUrl ?? null); }, [currentUrl]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("La imagen debe pesar menos de 5 MB.");
      return;
    }
    // Preview local inmediato
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);
    try {
      const url = await uploadAvatar(uid, file);
      // Actualizar Firebase Auth photoURL
      await updateProfile(auth.currentUser!, { photoURL: url });
      // Actualizar Firestore
      await updatePerfil(uid, { avatar_url: url });
      onUploaded(url);
    } catch (err) {
      console.error("Error al subir avatar:", err);
      setPreview(currentUrl ?? null);
      alert("No se pudo subir la imagen. Verificá las reglas de Firebase Storage.");
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localUrl);
    }
  }

  const inicial = displayName?.[0]?.toUpperCase() ?? "U";

  return (
    <div className="relative w-fit mx-auto">
      {/* Foto o inicial */}
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden shadow-lg"
        style={{ background: "var(--color-primary)", border: "3px solid var(--color-card-border)" }}
      >
        {preview ? (
          <img src={preview} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <span className="text-4xl font-black text-white">{inicial}</span>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full"
            style={{ background: "rgba(0,0,0,0.5)" }}>
            <Loader2 size={28} color="white" className="animate-spin" />
          </div>
        )}
      </div>

      {/* Botón de cámara */}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-110 cursor-pointer"
        style={{ background: "var(--color-primary)", border: "2px solid var(--color-card)" }}
        aria-label="Cambiar foto de perfil"
        title="Cambiar foto"
      >
        <Camera size={14} color="white" />
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

// ── Página principal de perfil ───────────────────────────────────────────────

function PerfilContent() {
  const { user } = useAuthContext();
  const router = useRouter();
  const { materias } = useMaterias(user?.uid ?? null);
  const { carreras, carreraActiva } = useCarreras(user?.uid ?? null);
  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [resetEnviado, setResetEnviado] = useState(false);
  const [enviandoReset, setEnviandoReset] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!user?.uid) return;
    getPerfilUsuario(user.uid).then((p) => {
      if (p) {
        setPerfil(p);
        setAvatarUrl(p.perfil.avatar_url ?? user.photoURL ?? undefined);
      }
    });
  }, [user]);

  // Estadísticas del perfil
  const materiasAprobadas = materias.filter(m => m.estado === "aprobada");
  const materiasCursando = materias.filter(m => m.estado === "cursando");
  const promedio = calcularPromedioGeneral(materias);
  const porcentaje = calcularPorcentajeAvance(materias, carreraActiva?.total_materias_plan);

  const saveField = useCallback(
    (campo: keyof Usuario["perfil"]) =>
      async (value: string) => {
        if (!user?.uid) return;
        await updatePerfil(user.uid, { [campo]: value });
        setPerfil(prev => prev
          ? { ...prev, perfil: { ...prev.perfil, [campo]: value } }
          : prev
        );
        // Actualizar displayName en Firebase Auth si es el nombre
        if (campo === "nombre" && auth.currentUser) {
          await updateProfile(auth.currentUser, { displayName: value });
        }
      },
    [user?.uid]
  );

  async function handleEnviarReset() {
    if (!user?.email) return;
    setEnviandoReset(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setResetEnviado(true);
    } finally {
      setEnviandoReset(false);
    }
  }

  async function handleSignOut() {
    await signOut(auth);
    router.push("/login");
  }

  const inputStyle = {
    background: "var(--background-alt)",
    border: "1.5px solid var(--color-card-border)",
    borderRadius: "var(--radius-md)",
  };

  // Stat card mini
  function StatMini({ label, value, icon: Icon, color }: {
    label: string; value: string | number; icon: React.ElementType; color: string;
  }) {
    return (
      <div className="flex flex-col items-center gap-1 py-3 px-2 rounded-2xl text-center flex-1"
        style={{ background: "var(--background-alt)" }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: color + "22" }}>
          <Icon size={16} style={{ color }} />
        </div>
        <p className="text-lg font-black" style={{ color: "var(--foreground)" }}>{value}</p>
        <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{label}</p>
      </div>
    );
  }

  const nombre = perfil?.perfil.nombre ?? user?.displayName ?? "";
  const email = perfil?.perfil.email ?? user?.email ?? "";
  const bio = perfil?.perfil.bio ?? "";
  const universidad = perfil?.perfil.universidad ?? "";
  const fechaCreacion = perfil?.perfil.fecha_creacion
    ? new Date(perfil.perfil.fecha_creacion).toLocaleDateString("es-AR", {
        year: "numeric", month: "long", day: "numeric"
      })
    : "";

  const isGoogleUser = user?.providerData?.[0]?.providerId === "google.com";

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-16">

        {/* Header */}
        <div className="mb-6">
          <Link href="/" className="text-sm mb-1 block hover:underline flex items-center gap-1"
            style={{ color: "var(--foreground-muted)" }}>
            <ArrowLeft size={14} />
            Volver al dashboard
          </Link>
          <h1 className="text-2xl font-extrabold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
            <User size={22} style={{ color: "var(--color-primary)" }} />
            Mi perfil
          </h1>
        </div>

        <div className="space-y-5">

          {/* ── Tarjeta de foto + nombre ──────────────────────────── */}
          <div className="rounded-2xl p-6 border flex flex-col items-center gap-5"
            style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>

            {user?.uid && (
              <AvatarUpload
                uid={user.uid}
                displayName={nombre}
                currentUrl={avatarUrl}
                onUploaded={(url) => {
                  setAvatarUrl(url);
                  setPerfil(prev => prev
                    ? { ...prev, perfil: { ...prev.perfil, avatar_url: url } }
                    : prev
                  );
                }}
              />
            )}

            <div className="w-full text-center">
              <p className="text-xl font-extrabold" style={{ color: "var(--foreground)" }}>{nombre}</p>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>{email}</p>
              {universidad && (
                <p className="text-xs mt-1 flex items-center justify-center gap-1"
                  style={{ color: "var(--foreground-subtle)" }}>
                  <GraduationCap size={12} />
                  {universidad}
                </p>
              )}
              {fechaCreacion && (
                <p className="text-xs mt-0.5 flex items-center justify-center gap-1"
                  style={{ color: "var(--foreground-subtle)" }}>
                  <Calendar size={12} />
                  Desde {fechaCreacion}
                </p>
              )}
            </div>

            {/* Stats mini */}
            <div className="flex gap-2 w-full">
              <StatMini
                label="Aprobadas"
                value={materiasAprobadas.length}
                icon={Award}
                color="var(--color-success)"
              />
              <StatMini
                label="Cursando"
                value={materiasCursando.length}
                icon={BookOpen}
                color="var(--color-primary)"
              />
              <StatMini
                label="Promedio"
                value={promedio > 0 ? promedio.toFixed(1) : "—"}
                icon={TrendingUp}
                color="var(--color-accent)"
              />
              <StatMini
                label="Avance"
                value={`${porcentaje}%`}
                icon={Clock}
                color="var(--color-secondary)"
              />
            </div>
          </div>

          {/* ── Información personal ──────────────────────────────── */}
          <div className="rounded-2xl p-5 border flex flex-col gap-4"
            style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
            <h2 className="font-bold text-base flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <User size={16} style={{ color: "var(--color-secondary)" }} />
              Información personal
            </h2>

            <CampoEditable
              label="Nombre completo"
              valor={nombre}
              placeholder="Tu nombre"
              icon={<User size={11} />}
              onSave={saveField("nombre")}
            />

            <CampoEditable
              label="Email"
              valor={email}
              placeholder="tu@email.com"
              icon={<Mail size={11} />}
              onSave={async () => {}}
              readOnly
            />

            <CampoEditable
              label="Universidad / Institución"
              valor={universidad}
              placeholder="Ej: UTN, UBA, UNC..."
              icon={<GraduationCap size={11} />}
              onSave={saveField("universidad")}
            />

            <CampoEditable
              label="Biografía"
              valor={bio}
              placeholder="Contá algo sobre vos, tu carrera o tus metas..."
              multiline
              maxLength={300}
              icon={<Edit3 size={11} />}
              onSave={saveField("bio")}
            />
          </div>

          {/* ── Seguridad ─────────────────────────────────────────── */}
          <div className="rounded-2xl p-5 border flex flex-col gap-4"
            style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
            <h2 className="font-bold text-base flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <KeyRound size={16} style={{ color: "var(--color-accent)" }} />
              Seguridad
            </h2>

            {isGoogleUser ? (
              <div className="p-3.5 rounded-xl text-sm"
                style={{ background: "var(--background-alt)", color: "var(--foreground-muted)" }}>
                Tu cuenta está vinculada a Google. La contraseña se gestiona desde tu cuenta de Google.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between p-3.5 rounded-xl"
                  style={{ background: "var(--background-alt)" }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      Contraseña
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                      {resetEnviado
                        ? "✅ Email de recuperación enviado a " + email
                        : "Recibís un email con un link para cambiarla"}
                    </p>
                  </div>
                  <button
                    id="btn-cambiar-password"
                    onClick={handleEnviarReset}
                    disabled={enviandoReset || resetEnviado}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all hover:opacity-80 flex-shrink-0"
                    style={{
                      borderColor: resetEnviado ? "var(--color-success)" : "var(--color-card-border)",
                      color: resetEnviado ? "var(--color-success)" : "var(--foreground)",
                      background: "var(--color-card)",
                    }}
                  >
                    {enviandoReset
                      ? <Loader2 size={12} className="animate-spin" />
                      : resetEnviado
                      ? <Check size={12} />
                      : <KeyRound size={12} />}
                    {resetEnviado ? "Enviado" : "Cambiar"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Links rápidos ─────────────────────────────────────── */}
          <div className="rounded-2xl border overflow-hidden"
            style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
            <Link
              href="/configuracion"
              className="flex items-center justify-between p-4 transition-all hover:opacity-80"
              style={{ borderBottom: "1px solid var(--color-card-border)" }}
            >
              <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                Configuración de la app
              </span>
              <ChevronRight size={16} style={{ color: "var(--foreground-subtle)" }} />
            </Link>
            <Link
              href="/carreras"
              className="flex items-center justify-between p-4 transition-all hover:opacity-80"
              style={{ borderBottom: "1px solid var(--color-card-border)" }}
            >
              <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                Mis carreras
              </span>
              <ChevronRight size={16} style={{ color: "var(--foreground-subtle)" }} />
            </Link>
            <button
              id="btn-cerrar-sesion-perfil"
              onClick={handleSignOut}
              className="w-full flex items-center justify-between p-4 transition-all hover:opacity-80 text-left"
              style={{ color: "var(--color-alert)" }}
            >
              <span className="text-sm font-semibold flex items-center gap-2">
                <LogOut size={14} />
                Cerrar sesión
              </span>
              <ChevronRight size={16} style={{ color: "var(--foreground-subtle)" }} />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function PerfilPage() {
  return <AuthGuard><PerfilContent /></AuthGuard>;
}
