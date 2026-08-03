// =========================================================
// MONTEFLORI — Sistema de Gestión Académica Inteligente
// types/index.ts — Definición completa de tipos TypeScript
// =========================================================

// ── Enums y tipos base ────────────────────────────────────

export type SistemaCalificacion = "ponderado" | "lineal" | "custom_formula";

export type EstadoMateria =
  | "cursando"
  | "aprobada"
  | "regular"
  | "libre"
  | "pendiente";

export type TipoEvaluacion = "parcial" | "recuperatorio" | "final" | "tp" | "coloquio" | "otro";

export type TemaApp = "claro" | "oscuro" | "sistema";

// ── Configuración de nota ──────────────────────────────────

export interface ConfiguracionNota {
  sistema: SistemaCalificacion;
  /** Fórmula matemática para sistema custom_formula. Variables: P1, P2, F, TP */
  formula_evaluacion?: string;
  nota_aprobar: number;
  nota_promocionar: number;
  requiere_asistencia?: boolean | number;
  /** Si el sistema es ponderado, pesos por tipo de evaluación */
  pesos?: {
    parciales?: number;
    trabajos_practicos?: number;
    coloquios?: number;
    finales?: number;
  };
}

// ── Evaluaciones ───────────────────────────────────────────

export interface Evaluacion {
  id: string;
  nombre: string;
  tipo: TipoEvaluacion;
  nota?: number | null;
  fecha?: string | null;
  /** Para sistema ponderado, ej: 0.6 */
  ponderacion?: number;
  /** Si fue recuperatorio de otro examen */
  recuperatorio_de?: string;
}

// ── Fechas importantes ─────────────────────────────────────

export interface FechaImportante {
  id: string;
  tipo: "parcial" | "recuperatorio" | "final" | "tp" | "coloquio" | "otro";
  nombre: string;
  fecha: string;
  /** ID del evento en Google Calendar, si fue sincronizado */
  calendar_event_id?: string;
  notificado?: boolean;
}

// ── Materia ────────────────────────────────────────────────

export interface Materia {
  id: string;
  nombre: string;
  /** Código interno del plan de estudios, ej: "LCD-105" */
  codigo_interno?: string;
  estado: EstadoMateria;
  configuracion_nota: ConfiguracionNota;
  evaluaciones: Evaluacion[];
  fechas_importantes?: FechaImportante[];
  asistencia_actual?: number;
  ultima_actualizacion: string;
  /** Período lectivo: "2024-1C", "2024-2C", "2024-anual" */
  periodo_cursado?: string;
  /** IDs de las carreras en las que figura esta materia */
  carreras_vinculadas?: string[];
  /** IDs de las materias que se deben tener aprobadas antes */
  correlativas_requisito?: string[];
  /** Año del plan de estudios en que aparece */
  año_plan?: number;
  /** Cuatrimestre del plan de estudios */
  cuatrimestre_plan?: number;
  /** Créditos o unidades de carga (para porcentaje de avance ponderado) */
  creditos?: number;
}

// ── Carrera ────────────────────────────────────────────────

export interface Carrera {
  id: string;
  nombre: string;
  institucion: string;
  /** Para saber si dos carreras comparten materias de la misma entidad */
  grupo_institucional?: string;
  plan_estudio_año?: number;
  fecha_inicio?: string;
  /** Total de materias del plan de estudios */
  total_materias_plan?: number;
  /** Color identificador para gráficos multi-carrera */
  color?: string;
}

// ── Perfil de Usuario ──────────────────────────────────────

export interface Perfil {
  nombre: string;
  email: string;
  fecha_creacion: string;
  avatar_url?: string;
  /** Descripción personal breve */
  bio?: string;
  /** Institución educativa principal */
  universidad?: string;
  /** Fecha en que el usuario comenzó sus estudios (ISO string) */
  fecha_inicio_estudios?: string;
}

export interface ConfiguracionUsuario {
  tema: TemaApp;
  telefono_whatsapp?: string;
  /** ID de la carrera seleccionada actualmente en el toggle. null = vista global */
  carrera_activa?: string | null;
  notificaciones_whatsapp: boolean;
  notificaciones_email: boolean;
  idioma?: "es" | "en";
}

export interface CredencialesExternas {
  /** Refresh token de Google Calendar, cifrado o almacenado con reglas de seguridad */
  google_calendar_refresh_token?: string;
  /** Para saber si el número de WhatsApp ya fue verificado */
  whatsapp_verificado?: boolean;
}

export interface Usuario {
  uid: string;
  perfil: Perfil;
  configuracion: ConfiguracionUsuario;
  credenciales_externas?: CredencialesExternas;
}

// ── Resultado de cálculo de notas ─────────────────────────

export interface ResultadoCalculo {
  promedio_actual: number;
  nota_proyectada: number | null;
  puede_promocionar: boolean;
  puede_aprobar: boolean;
  evaluaciones_completas: number;
  evaluaciones_totales: number;
  porcentaje_completado: number;
}

// ── Grafo de correlativas ──────────────────────────────────

export interface NodoGrafo {
  id: string;
  nombre: string;
  estado: EstadoMateria;
  habilitada: boolean;
  bloqueada_por: string[];
  habilita_a: string[];
}

// ── Stats del dashboard ────────────────────────────────────

export interface DashboardStats {
  porcentaje_avance: number;
  promedio_general: number;
  materias_aprobadas: number;
  materias_cursando: number;
  materias_pendientes: number;
  promedio_periodo_actual: number;
  proximo_examen: FechaImportante | null;
}

// ── Mensaje motivacional ───────────────────────────────────

export interface MensajeMotivacional {
  texto: string;
  emoji: string;
  tipo: "logro" | "aliento" | "alerta" | "bienvenida";
}
