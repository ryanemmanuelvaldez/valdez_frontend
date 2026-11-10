import { useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";

ChartJS.register(CategoryScale, Filler, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip);

export default function LineChart({ labels, datasets, formatValue, ariaLabel, className = "" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;

    const chart = new ChartJS(canvasRef.current, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: "index" },
        plugins: {
          legend: {
            display: datasets.length > 1,
            position: "bottom",
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${formatValue(context.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => formatValue(Number(value)),
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [ariaLabel, datasets, formatValue, labels]);

  return (
    <div className={`line-chart ${className}`.trim()} role="img" aria-label={ariaLabel}>
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
