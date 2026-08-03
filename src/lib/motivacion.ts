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
      texto: "¡Bienvenido a Monteflori! Cargá tus materias y arrancamos a seguirle la pista a tu carrera.",
      emoji: "✨",
      tipo: "bienvenida",
    };
  }

  // Hitos de porcentaje
  if (porcentaje >= 90) {
    return {
      texto: `¡Ya la tenés ahí nomás! Vas por el ${porcentaje}% de la carrera. El título está a la vuelta de la esquina, no aflojes justo ahora.`,
      emoji: "🏁",
      tipo: "logro",
    };
  }

  if (porcentaje >= 75) {
    return {
      texto: `¡Una locura lo tuyo! Ya vas por el ${porcentaje}% de la carrera — tres cuartos del camino hecho. Mirá todo lo que remaste para llegar hasta acá.`,
      emoji: "🌟",
      tipo: "logro",
    };
  }

  if (porcentaje >= 50) {
    return {
      texto: `¡Mitad de camino! Ya llevás ${aprobadas.length} materias aprobadas con un promedio de ${promedio.toFixed(1)}. Vas requetebién, seguí así.`,
      emoji: "🎯",
      tipo: "logro",
    };
  }

  if (porcentaje >= 25) {
    return {
      texto: `¡Ya metiste un cuarto de la carrera adentro! Con ${aprobadas.length} materias aprobadas, el camino está trazado. Dale para adelante.`,
      emoji: "💪",
      tipo: "aliento",
    };
  }

  // Promedio alto sin muchas aprobadas
  if (promedio >= 8 && aprobadas.length > 0) {
    return {
      texto: `Promedio de ${promedio.toFixed(1)} — eso no lo saca cualquiera. Con ${aprobadas.length} materias aprobadas, se nota que la estás remando en serio.`,
      emoji: "🔥",
      tipo: "logro",
    };
  }

  // Cursando varias materias
  if (cursando.length >= 3) {
    return {
      texto: `Estás cursando ${cursando.length} materias a la vez. Es mucho para bancarse solo, pero para eso estamos: para que no se te escape ninguna.`,
      emoji: "📚",
      tipo: "aliento",
    };
  }

  // Inicio de carrera
  if (aprobadas.length === 0 && cursando.length > 0) {
    return {
      texto: `¡Arrancaste! Ya estás cursando tu${cursando.length > 1 ? "s" : ""} primera${cursando.length > 1 ? "s" : ""} materia${cursando.length > 1 ? "s" : ""}. Todo suma, así que vamos de a poco.`,
      emoji: "🌱",
      tipo: "aliento",
    };
  }

  // Primera materia aprobada
  if (aprobadas.length === 1) {
    return {
      texto: `¡La primera siempre es la más brava! Ya aprobaste ${aprobadas[0].nombre} y demostraste que se puede. Ahora a por la que sigue.`,
      emoji: "🎉",
      tipo: "logro",
    };
  }

  // Genérico motivador
  const frasesGenericas: MensajeMotivacional[] = [
    {
      texto: `Ya llevás ${aprobadas.length} materias aprobadas. Cada una te deja más cerca del título — dale que vas bien.`,
      emoji: "📈",
      tipo: "aliento",
    },
    {
      texto: `Vas por el ${porcentaje}% de la carrera. Cada hora que le metiste al estudio está ahí, en ese número. Se nota, y vale la pena.`,
      emoji: "🧩",
      tipo: "aliento",
    },
    {
      texto: `Acordate: el que llega es el que no afloja. Y vos ya llevás ${aprobadas.length} materias en el bolsillo.`,
      emoji: "🏆",
      tipo: "aliento",
    },
  ];

  return frasesGenericas[aprobadas.length % frasesGenericas.length];
}
