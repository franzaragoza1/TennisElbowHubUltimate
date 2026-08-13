"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

export interface RankPoint {
  label: string; // "AAAA-WW"
  rank: number;
}

export function RankEvolutionChart({ data }: { data: RankPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = echarts.init(containerRef.current);
    chart.setOption({
      grid: { left: 40, right: 16, top: 16, bottom: 32 },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        data: data.map((d) => d.label),
        axisLabel: { fontSize: 11, color: "#6b7280" },
        axisLine: { lineStyle: { color: "#e5e7eb" } },
      },
      yAxis: {
        type: "value",
        inverse: true,
        min: 1,
        axisLabel: { fontSize: 11, color: "#6b7280" },
        splitLine: { lineStyle: { color: "#e5e7eb" } },
      },
      series: [
        {
          type: "line",
          data: data.map((d) => d.rank),
          symbol: "circle",
          symbolSize: 5,
          lineStyle: { color: "#0057b8", width: 2 },
          itemStyle: { color: "#0057b8" },
          areaStyle: { color: "rgba(0, 87, 184, 0.08)" },
        },
      ],
    });

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [data]);

  if (data.length === 0) {
    return <p className="text-muted-label py-8 text-sm">Sin historial de ranking todavía.</p>;
  }

  return <div ref={containerRef} className="h-72 w-full" />;
}
