// src/lib/motivacion.ts
// Generador de mensajes motivacionales basado en métricas reales del usuario

import { Materia, MensajeMotivacional } from "@/types";
import { calcularPromedioGeneral, calcularPorcentajeAvance } from "./calculo-notas";

export function generarMensajeMotivacional(
  materias: Materia[],
  totalMateriasPlan?: number
): MensajeMotivacional {
  const aprobadas = materias.filter((m) => m.estado === "aprobada");
  const cursando = materias.filter((m) => m.estado === "cursando");
  const porcentaje = calcularPorcentajeAvance(materias, totalMateriasPlan);
  const promedio = calcularPromedioGeneral(materias);

  // Bienvenida inicial
  if (materias.length === 0) {
    return {
      texto: "¡Bienvenido a Monteflori! Cargá tus materias y empezá a hacer seguimiento de tu carrera.",
      emoji: "✨",
      tipo: "bienvenida",
    };
  }

  // Hitos de porcentaje
  if (porcentaje >= 90) {
    return {
      texto: `¡Casi llegás! Tenés un ${porcentaje}% de la carrera completada. El final está a la vuelta de la esquina. ¡No aflojés ahora!`,
      emoji: "🏁",
      tipo: "logro",
    };
  }

  if (porcentaje >= 75) {
    return {
      texto: `¡Impresionante! Ya completaste el ${porcentaje}% de tu carrera. Tres cuartos del camino recorrido. Mirá todo lo que lograste.`,
      emoji: "🌟",
      tipo: "logro",
    };
  }

  if (porcentaje >= 50) {
    return {
      texto: `¡La mitad de la carrera completada! ${aprobadas.length} materias aprobadas y un promedio de ${promedio.toFixed(1)}. ¡Vas muy bien!`,
      emoji: "🎯",
      tipo: "logro",
    };
  }

  if (porcentaje >= 25) {
    return {
      texto: `¡Un cuarto de carrera adentro! Con ${aprobadas.length} materias aprobadas, el camino ya está trazado. Seguí así.`,
      emoji: "💪",
      tipo: "aliento",
    };
  }

  // Promedio alto sin muchas aprobadas
  if (promedio >= 8 && aprobadas.length > 0) {
    return {
      texto: `Promedio de ${promedio.toFixed(1)} — ¡eso no lo logra cualquiera! Con ${aprobadas.length} materias aprobadas, la calidad de tu trabajo habla sola.`,
      emoji: "🔥",
      tipo: "logro",
    };
  }

  // Cursando varias materias
  if (cursando.length >= 3) {
    return {
      texto: `Estás cursando ${cursando.length} materias al mismo tiempo. Es mucho para gestionar, ¡pero acá estamos para ayudarte a no perder de vista ninguna!`,
      emoji: "📚",
      tipo: "aliento",
    };
  }

  // Inicio de carrera
  if (aprobadas.length === 0 && cursando.length > 0) {
    return {
      texto: `¡Empezaste el camino! Estás cursando tu${cursando.length > 1 ? "s" : ""} primera${cursando.length > 1 ? "s" : ""} materia${cursando.length > 1 ? "s" : ""}. Cada paso cuenta.`,
      emoji: "🌱",
      tipo: "aliento",
    };
  }

  // Primera materia aprobada
  if (aprobadas.length === 1) {
    return {
      texto: `¡La primera siempre es la más difícil! Con ${aprobadas[0].nombre} aprobada, ya demostraste que podés. Ahora a por la siguiente.`,
      emoji: "🎉",
      tipo: "logro",
    };
  }

  // Genérico motivador
  const frasesGenericas: MensajeMotivacional[] = [
    {
      texto: `Llevás ${aprobadas.length} materias aprobadas. Cada una es un peldaño más hacia tu título. ¡Seguí sumando!`,
      emoji: "📈",
      tipo: "aliento",
    },
    {
      texto: `Un ${porcentaje}% de la carrera completada. Cada hora de estudio que pusiste está reflejada en ese número. Vale la pena.`,
      emoji: "🧩",
      tipo: "aliento",
    },
    {
      texto: `Recuerda: los que llegan son los que no se rinden. Ya llevas ${aprobadas.length} materias en el bolsillo.`,
      emoji: "🏆",
      tipo: "aliento",
    },
  ];

  return frasesGenericas[aprobadas.length % frasesGenericas.length];
}
