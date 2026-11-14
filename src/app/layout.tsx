import type { Metadata, Viewport } from "next";
import { Nunito, Fraunces } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { FeedbackProvider } from "@/components/ui/Feedback";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});

// Serif cálida para títulos y números grandes: le da carácter a la app sin
// competir con la sans del cuerpo.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Monteflori — Tu carrera, clara",
    template: "%s | Monteflori",
  },
  description:
    "Seguí tu carrera universitaria: materias, notas, fechas de examen y cuánto te falta, en un solo lugar.",
  keywords: ["estudiantes", "materias", "notas", "carrera", "universidad", "SIU Guaraní"],
  authors: [{ name: "Monteflori" }],
  robots: "index, follow",
  openGraph: {
    title: "Monteflori — Tu carrera, clara",
    description: "Materias, notas, fechas de examen y cuánto te falta, en un solo lugar.",
    type: "website",
    locale: "es_AR",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F1EA" },
    { media: "(prefers-color-scheme: dark)", color: "#211D19" },
  ],
};

// Corre antes del primer pintado: decide el tema y pone la clase .dark, así la
// página no parpadea en claro cuando el usuario eligió oscuro (o al revés).
// ThemeProvider lee el mismo valor al hidratar y la mantiene sincronizada.
const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem("monteflori-tema");var o=t==="oscuro"||(t!=="claro"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",o)}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${nunito.variable} ${fraunces.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col font-sans antialiased">
        <ThemeProvider>
          <AuthProvider>
            <FeedbackProvider>{children}</FeedbackProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
