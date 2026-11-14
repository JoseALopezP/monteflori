"use client";

// src/components/dashboard/DashboardNav.tsx
// Navegación de todo el dashboard.
//
// - Escritorio: barra superior con las cuatro secciones, el selector de
//   carrera, el botón "Agregar" y el menú de cuenta.
// - Celular: arriba quedan el logo, la carrera y la cuenta; las secciones bajan
//   a una barra fija al alcance del pulgar, con "Agregar" en el centro.
//
// "Agregar" es lo que más se usa (cargar una nota, agendar un examen), por eso
// está siempre a un toque, en cualquier pantalla.

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import {
  Home, BookOpen, Route, BarChart3, Plus, Award, CalendarPlus, BookPlus, RefreshCw,
  User, GraduationCap, Settings, Heart, LogOut, Sun, Moon,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useTheme } from "@/components/theme/ThemeProvider";
import { usePerfil } from "@/hooks/usePerfil";
import { useCarreraActivaContext } from "./CarreraActivaProvider";
import { CarreraToggle } from "./CarreraToggle";
import { Avatar } from "@/components/ui/kit";
import { AgregarNotaModal } from "@/components/notas/AgregarNotaModal";
import { FechaModal } from "@/components/notas/FechaModal";

const SECCIONES = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/materias", label: "Materias", icon: BookOpen },
  { href: "/materias/pasos", label: "Plan", labelLargo: "Plan de carrera", icon: Route },
  { href: "/graficos", label: "Gráficos", icon: BarChart3 },
];

/** Qué sección corresponde a la ruta actual (el detalle de una materia cuenta como "Materias") */
function seccionActiva(pathname: string): string | null {
  if (pathname === "/") return "/";
  if (pathname.startsWith("/materias/pasos")) return "/materias/pasos";
  if (pathname.startsWith("/materias")) return "/materias";
  if (pathname.startsWith("/graficos")) return "/graficos";
  return null;
}

export function DashboardNav() {
  const { user } = useAuthContext();
  const { perfil } = usePerfil();
  const { toggleTema, temaResuelto } = useTheme();
  const { materiasVisibles } = useCarreraActivaContext();
  const router = useRouter();
  const activa = seccionActiva(usePathname() ?? "/");

  const [modal, setModal] = useState<"nota" | "fecha" | null>(null);

  const nombre = perfil?.perfil.nombre || user?.displayName || "Estudiante";
  const foto = perfil?.perfil.avatar_url || user?.photoURL;
  const hayMaterias = materiasVisibles.length > 0;

  // Un tick después: deja que el menú termine de cerrarse y devuelva el foco
  // antes de que el diálogo lo tome.
  const abrir = (cual: "nota" | "fecha") => setTimeout(() => setModal(cual), 0);

  async function cerrarSesion() {
    await signOut(auth);
    router.replace("/login");
  }

  // El mismo menú se usa en la barra de arriba y en la de abajo.
  const menuAgregar = (
    <Dropdown.Portal>
      <Dropdown.Content className="menu w-64" align="center" sideOffset={10}>
        {hayMaterias && (
          <>
            <Dropdown.Item className="menu-item" onSelect={() => abrir("nota")}>
              <Award size={16} className="text-primary" /> Cargar una nota
            </Dropdown.Item>
            <Dropdown.Item className="menu-item" onSelect={() => abrir("fecha")}>
              <CalendarPlus size={16} className="text-primary" /> Agendar una fecha
            </Dropdown.Item>
            <div className="menu-sep" />
          </>
        )}
        <Dropdown.Item className="menu-item" asChild>
          <Link href="/materias/nueva">
            <BookPlus size={16} className="text-foreground-muted" /> Nueva materia
          </Link>
        </Dropdown.Item>
        <Dropdown.Item className="menu-item" asChild>
          <Link href="/materias/importar">
            <RefreshCw size={16} className="text-foreground-muted" /> Traer de SIU Guaraní
          </Link>
        </Dropdown.Item>
      </Dropdown.Content>
    </Dropdown.Portal>
  );

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-card-border bg-background/85 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0" aria-label="Monteflori, ir al inicio">
            <Image src="/logo.png" alt="" width={34} height={34} className="rounded-[10px]" priority />
            <span className="font-display font-semibold text-xl text-foreground hidden lg:block">Monteflori</span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5 ml-2" aria-label="Secciones">
            {SECCIONES.map(({ href, label, labelLargo }) => (
              <Link
                key={href}
                href={href}
                aria-current={activa === href ? "page" : undefined}
                className={`px-3 py-2 rounded-[var(--radius-md)] text-sm font-bold transition-colors ${
                  activa === href
                    ? "bg-primary-soft text-primary"
                    : "text-foreground-muted hover:text-foreground hover:bg-background-alt"
                }`}
              >
                {labelLargo ?? label}
              </Link>
            ))}
          </nav>

          <div className="flex-1 min-w-0 flex justify-center md:justify-end">
            <CarreraToggle />
          </div>

          <Dropdown.Root>
            <Dropdown.Trigger id="btn-agregar" className="btn btn-primary hidden md:inline-flex">
              <Plus size={16} strokeWidth={2.5} /> Agregar
            </Dropdown.Trigger>
            {menuAgregar}
          </Dropdown.Root>

          <Dropdown.Root>
            <Dropdown.Trigger
              className="rounded-full flex-shrink-0 transition-shadow hover:shadow-[0_0_0_3px_var(--color-primary-soft)]"
              aria-label="Tu cuenta"
            >
              <Avatar nombre={nombre} url={foto} size={38} />
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Content className="menu w-64" align="end" sideOffset={8}>
                <div className="px-3 py-2.5">
                  <p className="text-sm font-bold text-foreground truncate">{nombre}</p>
                  <p className="text-xs text-foreground-subtle truncate">{user?.email}</p>
                </div>
                <div className="menu-sep" />
                <Dropdown.Item className="menu-item" asChild>
                  <Link href="/perfil"><User size={16} className="text-foreground-muted" /> Mi perfil</Link>
                </Dropdown.Item>
                <Dropdown.Item className="menu-item" asChild>
                  <Link href="/carreras"><GraduationCap size={16} className="text-foreground-muted" /> Mis carreras</Link>
                </Dropdown.Item>
                <Dropdown.Item className="menu-item" asChild>
                  <Link href="/configuracion"><Settings size={16} className="text-foreground-muted" /> Configuración</Link>
                </Dropdown.Item>
                <Dropdown.Item
                  className="menu-item"
                  // Sin cerrar el menú: así se ve el cambio y se puede volver atrás al toque.
                  onSelect={(e) => { e.preventDefault(); toggleTema(); }}
                >
                  {temaResuelto === "oscuro"
                    ? <Sun size={16} className="text-foreground-muted" />
                    : <Moon size={16} className="text-foreground-muted" />}
                  {temaResuelto === "oscuro" ? "Pasar a modo claro" : "Pasar a modo oscuro"}
                </Dropdown.Item>
                <div className="menu-sep" />
                <Dropdown.Item className="menu-item" asChild>
                  <Link href="/donar"><Heart size={16} className="text-accent" /> Bancá el proyecto</Link>
                </Dropdown.Item>
                <Dropdown.Item className="menu-item menu-item-danger" onSelect={cerrarSesion}>
                  <LogOut size={16} /> Cerrar sesión
                </Dropdown.Item>
              </Dropdown.Content>
            </Dropdown.Portal>
          </Dropdown.Root>
        </div>
      </header>

      {/* Barra inferior — solo celular */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-card-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
        aria-label="Secciones"
      >
        <div className="grid grid-cols-5 items-end h-16 max-w-md mx-auto px-1">
          {SECCIONES.slice(0, 2).map((s) => <TabInferior key={s.href} {...s} activa={activa === s.href} />)}

          <div className="flex justify-center">
            <Dropdown.Root>
              <Dropdown.Trigger
                className="-translate-y-3 w-14 h-14 rounded-full bg-primary text-primary-fg flex items-center justify-center transition-transform active:scale-95"
                style={{ boxShadow: "var(--shadow-md)" }}
                aria-label="Agregar"
              >
                <Plus size={26} strokeWidth={2.5} />
              </Dropdown.Trigger>
              {menuAgregar}
            </Dropdown.Root>
          </div>

          {SECCIONES.slice(2).map((s) => <TabInferior key={s.href} {...s} activa={activa === s.href} />)}
        </div>
      </nav>

      {modal === "nota" && (
        <AgregarNotaModal materias={materiasVisibles} onCerrar={() => setModal(null)} />
      )}
      {modal === "fecha" && (
        <FechaModal materias={materiasVisibles} onCerrar={() => setModal(null)} />
      )}
    </>
  );
}

function TabInferior({
  href, label, icon: Icon, activa,
}: {
  href: string; label: string; icon: typeof Home; activa: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={activa ? "page" : undefined}
      className={`h-16 flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors ${
        activa ? "text-primary" : "text-foreground-subtle"
      }`}
    >
      <span
        className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors ${
          activa ? "bg-primary-soft" : ""
        }`}
      >
        <Icon size={20} strokeWidth={activa ? 2.4 : 2} />
      </span>
      {label}
    </Link>
  );
}
