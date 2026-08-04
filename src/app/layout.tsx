import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Monteflori — Gestión Académica",
    template: "%s | Monteflori",
  },
  description:
    "Sistema de Gestión Académica Inteligente. Seguí tu carrera, tus notas y tus metas en un solo lugar.",
  keywords: ["estudiantes", "materias", "notas", "carrera", "universidad", "gestión académica"],
  authors: [{ name: "Monteflori" }],
  robots: "index, follow",
  openGraph: {
    title: "Monteflori — Gestión Académica Inteligente",
    description: "Organizá tu carrera universitaria de forma inteligente.",
    type: "website",
    locale: "es_AR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${nunito.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans antialiased">
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
