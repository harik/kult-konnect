import React, { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ScaleMeasurement } from '@/types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TrendChartsProps {
  measurements: ScaleMeasurement[];
}

type Timeframe = '7D' | '30D' | '90D' | '1Y' | 'ALL';
type MetricKey = 'weightKg' | 'bodyFatPercent' | 'musclePercent' | 'waterPercent' | 'bmrKcal' | 'heartRateBpm';

export const TrendCharts: React.FC<TrendChartsProps> = ({ measurements }) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('30D');
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('weightKg');
  const [showMovingAverage, setShowMovingAverage] = useState(true);

  // Filter measurements by timeframe
  const filteredData = useMemo(() => {
    if (!measurements || measurements.length === 0) return [];
    
    // Sort chronological
    const sorted = [...measurements].sort((a, b) => a.timestamp - b.timestamp);
    const now = Date.now();

    let cutoff = 0;
    if (timeframe === '7D') cutoff = now - 7 * 86400000;
    else if (timeframe === '30D') cutoff = now - 30 * 86400000;
    else if (timeframe === '90D') cutoff = now - 90 * 86400000;
    else if (timeframe === '1Y') cutoff = now - 365 * 86400000;

    return sorted.filter(m => m.timestamp >= cutoff);
  }, [measurements, timeframe]);

  // Metric Labels & Colors
  const metricConfigs: Record<MetricKey, { label: string; unit: string; color: string; bg: string }> = {
    weightKg: { label: 'Weight', unit: 'kg', color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' },
    bodyFatPercent: { label: 'Body Fat', unit: '%', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)' },
    musclePercent: { label: 'Muscle', unit: '%', color: '#34d399', bg: 'rgba(52, 211, 153, 0.1)' },
    waterPercent: { label: 'Body Water', unit: '%', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.1)' },
    bmrKcal: { label: 'BMR', unit: 'kcal', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.1)' },
    heartRateBpm: { label: 'Heart Rate', unit: 'BPM', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)' },
  };

  const currentConfig = metricConfigs[selectedMetric];

  // Calculate 7-point Simple Moving Average
  const movingAverageData = useMemo(() => {
    if (!showMovingAverage || filteredData.length < 3) return [];
    const windowSize = 5;
    return filteredData.map((_, idx, arr) => {
      const start = Math.max(0, idx - windowSize + 1);
      const slice = arr.slice(start, idx + 1);
      const sum = slice.reduce((acc, curr) => acc + (Number(curr[selectedMetric]) || 0), 0);
      return Number((sum / slice.length).toFixed(1));
    });
  }, [filteredData, selectedMetric, showMovingAverage]);

  const chartData = {
    labels: filteredData.map(m =>
      new Date(m.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    ),
    datasets: [
      {
        label: currentConfig.label,
        data: filteredData.map(m => Number(m[selectedMetric]) || null),
        borderColor: currentConfig.color,
        backgroundColor: currentConfig.bg,
        fill: true,
        tension: 0.35,
        pointRadius: filteredData.length > 25 ? 2 : 4,
        pointHoverRadius: 6,
        borderWidth: 2.5,
      },
      ...(showMovingAverage && movingAverageData.length > 0 ? [{
        label: 'Trend (Moving Avg)',
        data: movingAverageData,
        borderColor: '#94a3b8',
        borderDash: [5, 5],
        borderWidth: 1.5,
        fill: false,
        pointRadius: 0,
        tension: 0.35,
      }] : []),
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: showMovingAverage,
        labels: {
          color: '#94a3b8',
          boxWidth: 12,
          font: { size: 11 },
        },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#e2e8f0',
        bodyColor: '#f8fafc',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx: any) => `${ctx.dataset.label}: ${ctx.raw} ${currentConfig.unit}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 0 },
      },
      y: {
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: {
          color: '#64748b',
          font: { size: 10 },
          callback: (value: any) => `${value} ${currentConfig.unit}`,
        },
      },
    },
  };

  if (!measurements || measurements.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        No historical measurements available to plot. Take a weigh-in to begin tracking!
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-md mx-auto pb-24">
      {/* Metric Selector Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        {(Object.keys(metricConfigs) as MetricKey[]).map(key => (
          <button
            key={key}
            onClick={() => setSelectedMetric(key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedMetric === key
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            {metricConfigs[key].label}
          </button>
        ))}
      </div>

      {/* Chart Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {currentConfig.label} History ({currentConfig.unit})
          </span>
          <button
            onClick={() => setShowMovingAverage(!showMovingAverage)}
            className={`text-[10px] font-medium px-2 py-1 rounded-md transition ${
              showMovingAverage ? 'bg-slate-800 text-brand-400' : 'bg-slate-900 text-slate-500'
            }`}
          >
            {showMovingAverage ? '✓ Smoothing on' : 'Smoothing off'}
          </button>
        </div>

        <div className="h-64 w-full">
          {filteredData.length > 0 ? (
            <Line data={chartData} options={options} />
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">
              No entries within selected timeframe.
            </div>
          )}
        </div>

        {/* Timeframe Toggles */}
        <div className="flex justify-between bg-slate-950/70 p-1 rounded-xl mt-4 border border-slate-800/80">
          {(['7D', '30D', '90D', '1Y', 'ALL'] as Timeframe[]).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                timeframe === tf
                  ? 'bg-brand-500 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
