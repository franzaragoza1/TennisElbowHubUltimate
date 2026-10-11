"use client";

import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

export interface RankPoint {
  label: string; // "AAAA-WW"
  rank: number;
}

/** Colores del tema actual, leídos de las variables CSS (pase visual, 2026-10-11): el
 * gráfico llevaba los grises y el azul del tema claro escritos a mano, y en el tema
 * oscuro (el de por defecto) la línea apenas se veía sobre el fondo. */
function themeColors() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return { line: v("--blue-500", "#2a3fd1"), label: v("--muted-label", "#575c7d"), rule: v("--rule", "#e1e3ef"), paper: v("--paper", "#ffffff"), ink: v("--ink", "#0c0e3d") };
}

/** Cambia cuando cambia `data-theme` en <html> (el botón de tema), para redibujar. */
function useThemeKey(): string {
  const [key, setKey] = useState("");
  useEffect(() => {
    const read = () => setKey(document.documentElement.getAttribute("data-theme") ?? "");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return key;
}

export function RankEvolutionChart({ data }: { data: RankPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const themeKey = useThemeKey();

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const c = themeColors();
    const chart = echarts.init(containerRef.current);
    chart.setOption({
      grid: { left: 40, right: 16, top: 16, bottom: 32 },
      tooltip: { trigger: "axis", backgroundColor: c.paper, borderColor: c.rule, textStyle: { color: c.ink } },
      xAxis: {
        type: "category",
        data: data.map((d) => d.label),
        axisLabel: { fontSize: 11, color: c.label },
        axisLine: { lineStyle: { color: c.rule } },
      },
      yAxis: {
        type: "value",
        inverse: true,
        min: 1,
        axisLabel: { fontSize: 11, color: c.label },
        splitLine: { lineStyle: { color: c.rule } },
      },
      series: [
        {
          type: "line",
          data: data.map((d) => d.rank),
          symbol: "circle",
          symbolSize: 5,
          lineStyle: { color: c.line, width: 2 },
          itemStyle: { color: c.line },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: `${c.line}33` },
              { offset: 1, color: `${c.line}00` },
            ]),
          },
        },
      ],
    });

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [data, themeKey]);

  if (data.length === 0) {
    return <p className="text-muted-label py-8 text-sm">No ranking history yet.</p>;
  }

  return <div ref={containerRef} className="h-72 w-full" />;
}
