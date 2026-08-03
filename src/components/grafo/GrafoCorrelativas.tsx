"use client";

// src/components/grafo/GrafoCorrelativas.tsx
// Visualizador de árbol de correlativas interactivo usando @xyflow/react

import { useMemo } from "react";
import { ReactFlow, Background, Controls, Node, Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Materia } from "@/types";
import { buildGrafo, grafoToReactFlow } from "@/lib/grafo-correlativas";
import { Layers } from "lucide-react";

interface GrafoCorrelativasProps {
  materias: Materia[];
}

export function GrafoCorrelativas({ materias }: GrafoCorrelativasProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const grafo = buildGrafo(materias);
    const { nodes, edges } = grafoToReactFlow(grafo, materias);
    return {
      initialNodes: nodes as Node[],
      initialEdges: edges as Edge[],
    };
  }, [materias]);

  if (materias.length === 0) {
    return (
      <div
        className="rounded-2xl p-8 border text-center flex flex-col items-center justify-center gap-3"
        style={{
          background: "var(--color-card)",
          borderColor: "var(--color-card-border)",
        }}
      >
        <Layers size={32} style={{ color: "var(--foreground-subtle)" }} />
        <p className="text-sm font-semibold" style={{ color: "var(--foreground-muted)" }}>
          No hay materias cargadas para mostrar el grafo de correlativas
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden relative shadow-sm"
      style={{
        height: 480,
        background: "var(--color-card)",
        borderColor: "var(--color-card-border)",
      }}
    >
      <div
        className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-xl border text-xs font-semibold backdrop-blur-md flex items-center gap-2"
        style={{
          background: "var(--color-card)",
          borderColor: "var(--color-card-border)",
          color: "var(--foreground)",
        }}
      >
        <Layers size={14} style={{ color: "var(--color-primary)" }} />
        Grafo de correlatividades
      </div>

      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        fitView
        attributionPosition="bottom-right"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--color-card-border)" gap={16} size={1} />
        <Controls
          style={{
            background: "var(--color-card)",
            borderColor: "var(--color-card-border)",
            color: "var(--foreground)",
            borderRadius: "12px",
            boxShadow: "var(--shadow-sm)",
          }}
        />
      </ReactFlow>
    </div>
  );
}
