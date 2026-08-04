"use client";

// src/components/dashboard/DashboardNav.tsx
// Navbar compartido de todo el dashboard: logo, selector de carrera activa,
// navegación principal (materias, plan de ruta, gráficos), acceso rápido a
// actualizar datos, tema y menú de usuario.

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  BookOpen, Settings, LogOut, Sun, Moon, RefreshCw,
  Layers, BarChart3, User, Menu, X,
} from "lucide-react";
import { useState } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useTheme } from "@/hooks/useTheme";
import { useCarreraActivaContext } from "./CarreraActivaProvider";
import { CarreraToggle } from "./CarreraToggle";

const LINKS = [
  { href: "/materias", label: "Materias", icon: BookOpen },
  { href: "/materias/pasos", label: "Plan de ruta", icon: Layers },
  { href: "/graficos", label: "Gráficos", icon: BarChart3 },
];

export function DashboardNav() {
  const { user } = useAuthContext();
  const { toggleTema, temaActual } = useTheme();
  const { carreras, carreraActivaId, setCarreraActivaId } = useCarreraActivaContext();
  const router = useRouter();
  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}
    >
      <div className="max-w-5xl mx-auto px-4 h-15 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <Image src="/logo.png" alt="Monteflori" width={32} height={32} className="rounded-lg" priority />
          <span className="font-semibold text-lg hidden sm:block" style={{ color: "var(--foreground)" }}>
            Monteflori
          </span>
        </Link>

        {/* Nav principal — desktop */}
        <nav className="hidden md:flex items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const activo = pathname === href || (href !== "/materias" && pathname?.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                style={{
                  background: activo ? "var(--background-alt)" : "transparent",
                  color: activo ? "var(--color-primary)" : "var(--foreground-muted)",
                }}
              >
                <Icon size={14} /> {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 flex justify-center md:flex-none">
          <CarreraToggle carreras={carreras} carreraActivaId={carreraActivaId} onChange={setCarreraActivaId} />
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href="/materias/importar"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all hover:opacity-80"
            style={{ borderColor: "var(--color-card-border)", color: "var(--foreground)" }}
          >
            <RefreshCw size={14} /> Actualizar datos
          </Link>

          <button
            onClick={toggleTema}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:opacity-75"
            style={{ background: "var(--background-alt)" }}
            title={temaActual === "oscuro" ? "Modo claro" : "Modo oscuro"}
            aria-label="Cambiar tema"
          >
            {temaActual === "oscuro"
              ? <Sun size={16} style={{ color: "var(--color-accent)" }} />
              : <Moon size={16} style={{ color: "var(--foreground-muted)" }} />}
          </button>

          <div className="relative group hidden md:block">
            <button
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm transition-all hover:opacity-80 overflow-hidden"
              style={{ background: "var(--color-primary)", color: "white" }}
              aria-label="Menú de usuario"
            >
              {user?.photoURL
                ? <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                : user?.displayName?.[0]?.toUpperCase() ?? "U"}
            </button>
            <div
              className="absolute right-0 top-full mt-2 w-52 rounded-xl border shadow-lg py-1 hidden group-focus-within:block group-hover:block"
              style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)", boxShadow: "var(--shadow-lg)", zIndex: 50 }}
            >
              <div className="px-4 py-2 border-b" style={{ borderColor: "var(--color-card-border)" }}>
                <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>{user?.displayName ?? "Estudiante"}</p>
                <p className="text-xs truncate" style={{ color: "var(--foreground-subtle)" }}>{user?.email}</p>
              </div>
              <Link href="/perfil" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:opacity-75 transition-opacity" style={{ color: "var(--foreground)" }}>
                <User size={14} /> Mi perfil
              </Link>
              <Link href="/configuracion" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:opacity-75 transition-opacity" style={{ color: "var(--foreground)" }}>
                <Settings size={14} /> Configuración
              </Link>
              <button
                onClick={async () => {
                  const { auth } = await import("@/lib/firebase");
                  const { signOut } = await import("firebase/auth");
                  await signOut(auth);
                  router.push("/login");
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:opacity-75 transition-opacity"
                style={{ color: "var(--color-alert)" }}
              >
                <LogOut size={14} /> Cerrar sesión
              </button>
            </div>
          </div>

          <button
            onClick={() => setMenuAbierto(!menuAbierto)}
            className="w-9 h-9 rounded-xl flex items-center justify-center md:hidden"
            style={{ background: "var(--background-alt)" }}
            aria-label="Menú"
          >
            {menuAbierto ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Nav — mobile */}
      {menuAbierto && (
        <div className="md:hidden border-t px-4 py-2 flex flex-col gap-1" style={{ borderColor: "var(--color-card-border)" }}>
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuAbierto(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium"
              style={{ color: "var(--foreground)" }}
            >
              <Icon size={15} /> {label}
            </Link>
          ))}
          <Link href="/materias/importar" onClick={() => setMenuAbierto(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium" style={{ color: "var(--foreground)" }}>
            <RefreshCw size={15} /> Actualizar datos
          </Link>
          <Link href="/perfil" onClick={() => setMenuAbierto(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium" style={{ color: "var(--foreground)" }}>
            <User size={15} /> Mi perfil
          </Link>
          <Link href="/configuracion" onClick={() => setMenuAbierto(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium" style={{ color: "var(--foreground)" }}>
            <Settings size={15} /> Configuración
          </Link>
        </div>
      )}
    </header>
  );
}
