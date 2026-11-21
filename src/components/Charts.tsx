import React, { useState } from 'react';
import { SEGMENT_COLORS } from '../engine/clustering';
import type {
  BusinessStrategy,
  ClusterSummary,
  DistributionAnalysis,
} from '../types/segmentation';

function fmt(n: number, dec = 2): string {
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) >= 1000) return n.toLocaleString('es-ES', { maximumFractionDigits: 1 });
  return n.toLocaleString('es-ES', { maximumFractionDigits: dec });
}

/* ------------------------------------------------------------------
   1. Correlation Heatmap
------------------------------------------------------------------ */
export const CorrelationHeatmap: React.FC<{
  variables: string[];
  matrix: number[][];
}> = ({ variables, matrix }) => {
  const [hovered, setHovered] = useState<{ i: number; j: number; r: number } | null>(null);

  if (variables.length === 0) return null;

  const getCellStyle = (r: number) => {
    const abs = Math.abs(r);
    if (r >= 0) {
      const alpha = Math.min(0.88, 0.08 + abs * 0.8);
      return {
        backgroundColor: `rgba(29, 78, 216, ${alpha.toFixed(2)})`,
        color: abs > 0.5 ? '#ffffff' : '#0f172a',
      };
    } else {
      const alpha = Math.min(0.88, 0.08 + abs * 0.8);
      return {
        backgroundColor: `rgba(217, 119, 6, ${alpha.toFixed(2)})`,
        color: abs > 0.5 ? '#ffffff' : '#0f172a',
      };
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-xs bg-blue-700" />
            Correlación positiva (+1.0)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-xs bg-amber-600" />
            Correlación negativa (-1.0)
          </span>
        </div>
        {hovered && (
          <div className="font-mono text-xs text-slate-800 tabular-nums">
            {variables[hovered.i]} × {variables[hovered.j]}: r = {hovered.r.toFixed(3)}
          </div>
        )}
      </div>
      <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-2 text-left font-medium text-slate-500 bg-slate-50 border-b border-r border-slate-200 min-w-[140px]">
                Variable
              </th>
              {variables.map((v) => (
                <th
                  key={v}
                  className="p-2 text-center font-medium text-slate-700 bg-slate-50 border-b border-slate-200 min-w-[76px] max-w-[110px] truncate"
                  title={v}
                >
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {variables.map((rowVar, i) => (
              <tr key={rowVar}>
                <td
                  className="p-2 font-medium text-slate-800 bg-slate-50 border-r border-b border-slate-200 truncate max-w-[160px]"
                  title={rowVar}
                >
                  {rowVar}
                </td>
                {variables.map((colVar, j) => {
                  const r = matrix[i]?.[j] ?? 0;
                  const style = getCellStyle(r);
                  const isDiag = i === j;
                  return (
                    <td
                      key={`${rowVar}-${colVar}`}
                      onMouseEnter={() => setHovered({ i, j, r })}
                      onMouseLeave={() => setHovered(null)}
                      style={isDiag ? { backgroundColor: '#f1f5f9', color: '#475569' } : style}
                      className="p-2 text-center font-mono tabular-nums border-b border-slate-100 transition-opacity cursor-default"
                    >
                      {r.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------
   2. Histogram + KDE Density Chart
------------------------------------------------------------------ */
export const HistogramWithKdeChart: React.FC<{
  analysis: DistributionAnalysis;
  mean?: number;
  median?: number;
  height?: number;
}> = ({ analysis, mean, median, height = 190 }) => {
  const [hoverBin, setHoverBin] = useState<number | null>(null);
  const w = 440;
  const h = height;
  const padL = 36;
  const padR = 14;
  const padT = 16;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const bins = analysis.histogramBins;
  if (bins.length === 0) return null;

  const minX = bins[0].x0;
  const maxX = bins[bins.length - 1].x1;
  const spanX = Math.max(1e-9, maxX - minX);
  const maxDensity = Math.max(
    1e-9,
    ...bins.map((b) => b.density),
    ...analysis.kdeCurve.map((k) => k.y)
  );

  const toX = (x: number) => padL + ((x - minX) / spanX) * innerW;
  const toY = (d: number) => padT + innerH - (d / (maxDensity * 1.12)) * innerH;

  const kdePath =
    analysis.kdeCurve.length > 1
      ? analysis.kdeCurve
          .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(pt.x).toFixed(1)} ${toY(pt.y).toFixed(1)}`)
          .join(' ')
      : '';

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto overflow-visible">
        <line x1={padL} y1={padT + innerH} x2={w - padR} y2={padT + innerH} stroke="#cbd5e1" />
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#cbd5e1" />

        {bins.map((b, idx) => {
          const x = toX(b.x0);
          const bw = Math.max(2, toX(b.x1) - x - 1.5);
          const y = toY(b.density);
          const barH = Math.max(0, padT + innerH - y);
          const isHov = hoverBin === idx;
          return (
            <rect
              key={idx}
              x={x}
              y={y}
              width={bw}
              height={barH}
              rx={1.5}
              fill={isHov ? '#1d4ed8' : '#93c5fd'}
              stroke={isHov ? '#1e3a8a' : '#60a5fa'}
              strokeWidth={0.7}
              onMouseEnter={() => setHoverBin(idx)}
              onMouseLeave={() => setHoverBin(null)}
            />
          );
        })}

        {kdePath && (
          <path d={kdePath} fill="none" stroke="#0f172a" strokeWidth={1.8} strokeLinecap="round" />
        )}

        {mean !== undefined && Number.isFinite(mean) && (
          <line
            x1={toX(mean)}
            y1={padT}
            x2={toX(mean)}
            y2={padT + innerH}
            stroke="#dc2626"
            strokeWidth={1.4}
            strokeDasharray="4 3"
          />
        )}
        {median !== undefined && Number.isFinite(median) && (
          <line
            x1={toX(median)}
            y1={padT}
            x2={toX(median)}
            y2={padT + innerH}
            stroke="#059669"
            strokeWidth={1.4}
            strokeDasharray="2 2"
          />
        )}

        <text x={padL} y={h - 8} fontSize="10" fill="#64748b" fontFamily="JetBrains Mono">
          {fmt(minX, 1)}
        </text>
        <text
          x={padL + innerW / 2}
          y={h - 8}
          fontSize="10"
          fill="#64748b"
          textAnchor="middle"
          fontFamily="JetBrains Mono"
        >
          {fmt((minX + maxX) / 2, 1)}
        </text>
        <text
          x={w - padR}
          y={h - 8}
          fontSize="10"
          fill="#64748b"
          textAnchor="end"
          fontFamily="JetBrains Mono"
        >
          {fmt(maxX, 1)}
        </text>
      </svg>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-slate-900" /> Densidad KDE
          </span>
          {mean !== undefined && (
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 border-t border-dashed border-red-600" /> Media ({fmt(mean, 1)})
            </span>
          )}
          {median !== undefined && (
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 border-t border-dotted border-emerald-600" /> Mediana ({fmt(median, 1)})
            </span>
          )}
        </div>
        {hoverBin !== null && bins[hoverBin] && (
          <span className="font-mono text-slate-800 tabular-nums">
            [{fmt(bins[hoverBin].x0, 1)}, {fmt(bins[hoverBin].x1, 1)}): {bins[hoverBin].count} reg.
          </span>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------
   3. Boxplot Chart
------------------------------------------------------------------ */
export const BoxplotChart: React.FC<{
  analysis: DistributionAnalysis;
}> = ({ analysis }) => {
  const { minWhisker, q1, median, q3, maxWhisker, outliers } = analysis.boxplot;
  const allVals = [minWhisker, maxWhisker, ...outliers];
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const span = Math.max(1e-9, maxV - minV);

  const w = 440;
  const h = 68;
  const padL = 20;
  const padR = 20;
  const innerW = w - padL - padR;
  const toX = (v: number) => padL + ((v - minV) / span) * innerW;

  const cy = 26;
  const boxH = 22;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      <line x1={toX(minWhisker)} y1={cy} x2={toX(q1)} y2={cy} stroke="#475569" strokeWidth={1.5} />
      <line x1={toX(q3)} y1={cy} x2={toX(maxWhisker)} y2={cy} stroke="#475569" strokeWidth={1.5} />
      <line x1={toX(minWhisker)} y1={cy - 7} x2={toX(minWhisker)} y2={cy + 7} stroke="#475569" strokeWidth={1.5} />
      <line x1={toX(maxWhisker)} y1={cy - 7} x2={toX(maxWhisker)} y2={cy + 7} stroke="#475569" strokeWidth={1.5} />

      <rect
        x={toX(q1)}
        y={cy - boxH / 2}
        width={Math.max(2, toX(q3) - toX(q1))}
        height={boxH}
        rx={3}
        fill="#dbeafe"
        stroke="#1d4ed8"
        strokeWidth={1.5}
      />
      <line
        x1={toX(median)}
        y1={cy - boxH / 2}
        x2={toX(median)}
        y2={cy + boxH / 2}
        stroke="#1e3a8a"
        strokeWidth={2.2}
      />

      {outliers.map((ov, idx) => (
        <circle
          key={idx}
          cx={toX(ov)}
          cy={cy}
          r={2.5}
          fill="#d97706"
          fillOpacity={0.75}
        />
      ))}

      <text x={toX(minWhisker)} y={58} fontSize="9.5" fill="#64748b" textAnchor="middle" fontFamily="JetBrains Mono">
        {fmt(minWhisker, 1)}
      </text>
      <text x={toX(median)} y={58} fontSize="9.5" fill="#0f172a" textAnchor="middle" fontFamily="JetBrains Mono">
        Q2: {fmt(median, 1)}
      </text>
      <text x={toX(maxWhisker)} y={58} fontSize="9.5" fill="#64748b" textAnchor="middle" fontFamily="JetBrains Mono">
        {fmt(maxWhisker, 1)}
      </text>
    </svg>
  );
};

/* ------------------------------------------------------------------
   4. Generic / PCA 2D Scatter Plot
------------------------------------------------------------------ */
export interface ScatterPoint {
  x: number;
  y: number;
  clusterId: number;
  label?: string;
}

export const ScatterPlot2D: React.FC<{
  points: ScatterPoint[];
  centroids?: { x: number; y: number; clusterId: number; name?: string }[];
  xLabel: string;
  yLabel: string;
  height?: number;
}> = ({ points, centroids = [], xLabel, yLabel, height = 340 }) => {
  const [hovered, setHovered] = useState<ScatterPoint | null>(null);
  if (points.length === 0) return null;

  const w = 640;
  const h = height;
  const padL = 52;
  const padR = 20;
  const padT = 20;
  const padB = 42;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);

  const toX = (x: number) => padL + ((x - minX) / spanX) * innerW;
  const toY = (y: number) => padT + innerH - ((y - minY) / spanY) * innerH;

  // Subsample gently only if huge (> 900 pts) to keep DOM instantaneous
  const displayPts =
    points.length > 900
      ? points.filter((_, i) => i % Math.ceil(points.length / 900) === 0)
      : points;

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto bg-white border border-slate-200 rounded-lg">
        {/* Grid */}
        {[0.25, 0.5, 0.75].map((t) => (
          <g key={t}>
            <line
              x1={padL}
              y1={padT + innerH * t}
              x2={w - padR}
              y2={padT + innerH * t}
              stroke="#f1f5f9"
            />
            <line
              x1={padL + innerW * t}
              y1={padT}
              x2={padL + innerW * t}
              y2={padT + innerH}
              stroke="#f1f5f9"
            />
          </g>
        ))}

        <line x1={padL} y1={padT + innerH} x2={w - padR} y2={padT + innerH} stroke="#cbd5e1" />
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#cbd5e1" />

        {displayPts.map((pt, idx) => {
          const color =
            pt.clusterId === -1
              ? '#64748b'
              : SEGMENT_COLORS[pt.clusterId % SEGMENT_COLORS.length];
          return (
            <circle
              key={idx}
              cx={toX(pt.x)}
              cy={toY(pt.y)}
              r={hovered === pt ? 5.5 : 3.4}
              fill={color}
              fillOpacity={pt.clusterId === -1 ? 0.55 : 0.72}
              stroke="#ffffff"
              strokeWidth={0.6}
              onMouseEnter={() => setHovered(pt)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}

        {centroids.map((c) => {
          const color = SEGMENT_COLORS[c.clusterId % SEGMENT_COLORS.length];
          const cx = toX(c.x);
          const cy = toY(c.y);
          return (
            <g key={`c-${c.clusterId}`}>
              <circle cx={cx} cy={cy} r={8.5} fill="#ffffff" stroke={color} strokeWidth={2.5} />
              <circle cx={cx} cy={cy} r={3.5} fill={color} />
            </g>
          );
        })}

        <text x={padL + innerW / 2} y={h - 10} textAnchor="middle" fontSize="11" fill="#475569">
          {xLabel}
        </text>
        <text
          x={14}
          y={padT + innerH / 2}
          textAnchor="middle"
          fontSize="11"
          fill="#475569"
          transform={`rotate(-90 14 ${padT + innerH / 2})`}
        >
          {yLabel}
        </text>
        <text x={padL} y={padT + innerH + 14} fontSize="9.5" fill="#64748b" fontFamily="JetBrains Mono">
          {fmt(minX, 2)}
        </text>
        <text x={w - padR} y={padT + innerH + 14} textAnchor="end" fontSize="9.5" fill="#64748b" fontFamily="JetBrains Mono">
          {fmt(maxX, 2)}
        </text>
      </svg>

      {hovered && (
        <div className="text-xs font-mono text-slate-700 bg-slate-100 px-3 py-1.5 rounded border border-slate-200 tabular-nums">
          {hovered.label ?? 'Observación'} · {xLabel}: {fmt(hovered.x, 3)} · {yLabel}: {fmt(hovered.y, 3)}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------
   5. Optimal-K Metric Line Chart
------------------------------------------------------------------ */
export const MetricLineChart: React.FC<{
  title: string;
  data: { k: number; value: number; err?: number }[];
  recommendedK: number;
  color?: string;
  valueDecimals?: number;
}> = ({ title, data, recommendedK, color = '#1d4ed8', valueDecimals = 3 }) => {
  if (data.length === 0) return null;

  const w = 380;
  const h = 190;
  const padL = 52;
  const padR = 18;
  const padT = 20;
  const padB = 30;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const ks = data.map((d) => d.k);
  const vals = data.flatMap((d) =>
    d.err ? [d.value - d.err, d.value + d.err] : [d.value]
  );
  const minK = Math.min(...ks);
  const maxK = Math.max(...ks);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const spanV = Math.max(1e-6, maxV - minV);

  const toX = (k: number) =>
    padL + ((k - minK) / Math.max(1, maxK - minK)) * innerW;
  const toY = (v: number) =>
    padT + innerH - ((v - minV) / spanV) * innerH;

  const path = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(d.k).toFixed(1)} ${toY(d.value).toFixed(1)}`)
    .join(' ');

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        <span className="text-xs font-mono text-blue-700 tabular-nums">
          Sugerido: k = {recommendedK}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
        <line x1={padL} y1={padT + innerH} x2={w - padR} y2={padT + innerH} stroke="#cbd5e1" />
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#cbd5e1" />

        {/* Vertical guide for recommended K */}
        <line
          x1={toX(recommendedK)}
          y1={padT}
          x2={toX(recommendedK)}
          y2={padT + innerH}
          stroke="#94a3b8"
          strokeDasharray="3 3"
        />

        <path d={path} fill="none" stroke={color} strokeWidth={2.2} />

        {data.map((d) => {
          const cx = toX(d.k);
          const cy = toY(d.value);
          const isRec = d.k === recommendedK;
          return (
            <g key={d.k}>
              {d.err !== undefined && d.err > 0 && (
                <line
                  x1={cx}
                  y1={toY(d.value - d.err)}
                  x2={cx}
                  y2={toY(d.value + d.err)}
                  stroke={color}
                  strokeOpacity={0.45}
                  strokeWidth={1.5}
                />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={isRec ? 5 : 3.5}
                fill={isRec ? '#ffffff' : color}
                stroke={color}
                strokeWidth={2}
              />
              <text
                x={cx}
                y={padT + innerH + 16}
                textAnchor="middle"
                fontSize="10"
                fontWeight={isRec ? '700' : '400'}
                fill={isRec ? '#0f172a' : '#64748b'}
                fontFamily="JetBrains Mono"
              >
                {d.k}
              </text>
            </g>
          );
        })}

        <text x={padL - 6} y={padT + 4} textAnchor="end" fontSize="9.5" fill="#64748b" fontFamily="JetBrains Mono">
          {fmt(maxV, valueDecimals)}
        </text>
        <text x={padL - 6} y={padT + innerH} textAnchor="end" fontSize="9.5" fill="#64748b" fontFamily="JetBrains Mono">
          {fmt(minV, valueDecimals)}
        </text>
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------
   6. Standardized Centroid Diverging Chart
------------------------------------------------------------------ */
export const CentroidProfileChart: React.FC<{
  summaries: ClusterSummary[];
  variables: string[];
}> = ({ summaries, variables }) => {
  if (summaries.length === 0 || variables.length === 0) return null;

  const allZs = summaries.flatMap((s) =>
    variables.map((v) => s.standardizedCentroid[v] ?? 0)
  );
  const maxAbsZ = Math.max(1.5, ...allZs.map((z) => Math.abs(z)));

  return (
    <div className="space-y-4">
      {variables.map((variable) => (
        <div key={variable} className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-800">{variable}</span>
            <span className="text-slate-500 font-mono">Desviación Z vs promedio global</span>
          </div>
          <div className="space-y-1">
            {summaries.map((s) => {
              const z = s.standardizedCentroid[variable] ?? 0;
              const pctWidth = Math.min(50, (Math.abs(z) / maxAbsZ) * 48);
              const color =
                s.clusterId === -1
                  ? '#64748b'
                  : SEGMENT_COLORS[s.clusterId % SEGMENT_COLORS.length];
              return (
                <div key={`${variable}-${s.clusterId}`} className="flex items-center gap-3 text-xs">
                  <div className="w-44 truncate text-slate-600" title={s.strategicName}>
                    {s.strategicName}
                  </div>
                  <div className="relative flex-1 h-4 bg-slate-100 rounded overflow-hidden">
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300" />
                    <div
                      className="absolute top-0.5 bottom-0.5 rounded-xs"
                      style={{
                        backgroundColor: color,
                        left: z >= 0 ? '50%' : `${50 - pctWidth}%`,
                        width: `${pctWidth}%`,
                      }}
                    />
                  </div>
                  <div className="w-16 text-right font-mono tabular-nums text-slate-800">
                    {z >= 0 ? '+' : ''}
                    {z.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------
   7. Impact & Effort 4-Quadrant Matrix
------------------------------------------------------------------ */
export const ImpactEffortMatrixChart: React.FC<{
  strategies: BusinessStrategy[];
  onSelectStrategy?: (s: BusinessStrategy) => void;
  selectedId?: string;
}> = ({ strategies, onSelectStrategy, selectedId }) => {
  const [hovered, setHovered] = useState<BusinessStrategy | null>(null);
  const w = 640;
  const h = 380;
  const padL = 56;
  const padR = 24;
  const padT = 24;
  const padB = 44;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const toX = (effort: number) => padL + ((effort - 1) / 9) * innerW;
  const toY = (impact: number) => padT + innerH - ((impact - 1) / 9) * innerH;
  const midX = toX(5.5);
  const midY = toY(5.5);

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto bg-white border border-slate-200 rounded-lg">
        {/* Quadrant fills */}
        <rect x={padL} y={padT} width={midX - padL} height={midY - padT} fill="#ecfdf5" fillOpacity={0.55} />
        <rect x={midX} y={padT} width={padL + innerW - midX} height={midY - padT} fill="#eff6ff" fillOpacity={0.55} />
        <rect x={padL} y={midY} width={midX - padL} height={padT + innerH - midY} fill="#f8fafc" />
        <rect x={midX} y={midY} width={padL + innerW - midX} height={padT + innerH - midY} fill="#fef2f2" fillOpacity={0.45} />

        {/* Quadrant divider lines */}
        <line x1={midX} y1={padT} x2={midX} y2={padT + innerH} stroke="#94a3b8" strokeDasharray="4 4" />
        <line x1={padL} y1={midY} x2={padL + innerW} y2={midY} stroke="#94a3b8" strokeDasharray="4 4" />

        {/* Quadrant labels */}
        <text x={padL + 10} y={padT + 18} fontSize="11" fontWeight="600" fill="#047857">
          C1: Alto Impacto / Bajo Esfuerzo (Prioritarias)
        </text>
        <text x={w - padR - 10} y={padT + 18} textAnchor="end" fontSize="11" fontWeight="600" fill="#1d4ed8">
          C2: Alto Impacto / Alto Esfuerzo (Estratégicas)
        </text>
        <text x={padL + 10} y={padT + innerH - 10} fontSize="11" fontWeight="600" fill="#475569">
          C3: Bajo Impacto / Bajo Esfuerzo (Complementarias)
        </text>
        <text x={w - padR - 10} y={padT + innerH - 10} textAnchor="end" fontSize="11" fontWeight="600" fill="#b91c1c">
          C4: Bajo Impacto / Alto Esfuerzo (Aplazar)
        </text>

        {/* Axes */}
        <line x1={padL} y1={padT + innerH} x2={w - padR} y2={padT + innerH} stroke="#cbd5e1" />
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#cbd5e1" />

        {/* Strategy bubbles with slight deterministic jitter if overlapping */}
        {strategies.map((st, idx) => {
          const jitterX = ((idx % 3) - 1) * 6;
          const jitterY = (((idx + 1) % 3) - 1) * 6;
          const cx = Math.min(w - padR - 10, Math.max(padL + 10, toX(st.effortScore) + jitterX));
          const cy = Math.min(padT + innerH - 10, Math.max(padT + 10, toY(st.impactScore) + jitterY));
          const color =
            st.clusterId === -1
              ? '#64748b'
              : SEGMENT_COLORS[st.clusterId % SEGMENT_COLORS.length];
          const isSel = selectedId === st.id || hovered?.id === st.id;

          return (
            <g
              key={st.id}
              className="cursor-pointer"
              onMouseEnter={() => setHovered(st)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelectStrategy?.(st)}
            >
              <circle
                cx={cx}
                cy={cy}
                r={isSel ? 12 : 9.5}
                fill={color}
                fillOpacity={0.9}
                stroke={isSel ? '#0f172a' : '#ffffff'}
                strokeWidth={isSel ? 2.5 : 1.8}
              />
              <text
                x={cx}
                y={cy + 3.5}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="700"
                fill="#ffffff"
                fontFamily="JetBrains Mono"
              >
                {idx + 1}
              </text>
            </g>
          );
        })}

        <text x={padL + innerW / 2} y={h - 10} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#334155">
          Esfuerzo Requerido (1 = Mínimo · 10 = Máximo)
        </text>
        <text
          x={16}
          y={padT + innerH / 2}
          textAnchor="middle"
          fontSize="11.5"
          fontWeight="600"
          fill="#334155"
          transform={`rotate(-90 16 ${padT + innerH / 2})`}
        >
          Impacto Esperado (1 = Bajo · 10 = Transformacional)
        </text>
      </svg>

      {hovered && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
          <div className="font-semibold text-slate-900">
            {hovered.segmentName} — {hovered.strategicAxis}
          </div>
          <div className="mt-1">{hovered.proposedStrategy}</div>
          <div className="mt-1 font-mono text-slate-600 tabular-nums">
            Impacto: {hovered.impactScore}/10 · Esfuerzo: {hovered.effortScore}/10 · {hovered.quadrant}
          </div>
        </div>
      )}
    </div>
  );
};
