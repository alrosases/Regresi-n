import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Play, RefreshCw } from 'lucide-react';
import { MetricLineChart, ScatterPlot2D } from '../Charts';
import {
  SEGMENT_COLORS,
  executeClusteringModel,
  runKMeansRaw,
  suggestDbscanEps,
} from '../../engine/clustering';
import type {
  BusinessContext,
  ClusteringAlgorithm,
  ClusteringModelResult,
  ClusteringRunParams,
  OptimalKAnalysis,
  PreparedDataResult,
} from '../../types/segmentation';

/* ============================================================================
   MÓDULO 9. IDENTIFICACIÓN DEL NÚMERO ÓPTIMO DE CLUSTERS
============================================================================ */
export const Module9OptimalK: React.FC<{
  analysis: OptimalKAnalysis | null;
  isComputing: boolean;
  onRecompute: () => void;
  onNext: () => void;
}> = ({ analysis, isComputing, onRecompute, onNext }) => {
  if (!analysis) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-3">
        <div className="text-sm font-semibold text-slate-900">
          Cálculo de métodos para número óptimo de clusters
        </div>
        <p className="text-xs text-slate-600">
          Ejecuta la evaluación multi-criterio (k = 2 hasta 8) para comparar Codo, Silueta, Estadística Gap, Calinski-Harabasz y Davies-Bouldin.
        </p>
        <button
          type="button"
          onClick={onRecompute}
          disabled={isComputing}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 cursor-pointer"
        >
          {isComputing ? 'Evaluando modelos...' : 'Calcular métodos de K óptimo'}
        </button>
      </div>
    );
  }

  const comparisonRows = [
    {
      method: 'Método del Codo (Inercia WCSS)',
      measures: 'Suma de distancias cuadráticas intra-cluster (cohesión interna).',
      interpret: 'Buscar el punto de inflexión donde la reducción marginal de inercia cae bruscamente.',
      kRec: analysis.elbowRecommendedK,
      limits: 'A veces la curva es suave sin un codo nítido; siempre disminuye al aumentar k.',
    },
    {
      method: 'Coeficiente de Silueta',
      measures: 'Balance entre cohesión interna y separación respecto al cluster vecino más cercano [-1, +1].',
      interpret: 'Valores más cercanos a +1 indican grupos bien separados y compactos.',
      kRec: analysis.silhouetteRecommendedK,
      limits: 'Favorece clusters convexos/esféricos y puede penalizar formas alargadas o subgrupos jerárquicos.',
    },
    {
      method: 'Estadística Gap (Tibshirani)',
      measures: 'Diferencia entre log(WCSS) esperado bajo distribución uniforme nula y el observado.',
      interpret: 'Primer k donde Gap(k) ≥ Gap(k+1) − error estándar s_{k+1}.',
      kRec: analysis.gapRecommendedK,
      limits: 'Depende del muestreo de referencia uniforme y puede preferir k mayores si hay colas.',
    },
    {
      method: 'Índice Calinski-Harabasz',
      measures: 'Razón entre dispersión inter-cluster e intra-cluster ajustada por grados de libertad.',
      interpret: 'Valores más altos señalan clusters más densos y separados.',
      kRec: analysis.calinskiRecommendedK,
      limits: 'Tiende a ser mayor con clusters de tamaño uniforme y geometría globular.',
    },
    {
      method: 'Índice Davies-Bouldin',
      measures: 'Similitud promedio de cada cluster con su cluster más cercano.',
      interpret: 'Valores más bajos (cercanos a 0) indican mejor separación entre segmentos.',
      kRec: analysis.daviesRecommendedK,
      limits: 'Basado en centroides y distancias euclidianas; sensible a densidad heterogénea.',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="text-xs font-medium text-blue-700">Módulo 09 · Diagnóstico Multi-Criterio</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Identificación del Número Óptimo de Clusters
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-3xl">
            Ningún indicador único define la verdad de negocio. Compara cinco criterios estadísticos independientes antes de decidir la granularidad estratégica en el Módulo 10.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRecompute}
            disabled={isComputing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Recalcular
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Continuar a Selección según Negocio
          </button>
        </div>
      </div>

      {/* Independent Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MetricLineChart
          title="1. Método del Codo (Inercia / WCSS)"
          data={analysis.metrics.map((m) => ({ k: m.k, value: m.inertia }))}
          recommendedK={analysis.elbowRecommendedK}
          color="#1d4ed8"
          valueDecimals={1}
        />
        <MetricLineChart
          title="2. Coeficiente de Silueta Promedio (Mayor es mejor)"
          data={analysis.metrics.map((m) => ({ k: m.k, value: m.silhouette }))}
          recommendedK={analysis.silhouetteRecommendedK}
          color="#059669"
          valueDecimals={3}
        />
        <MetricLineChart
          title="3. Estadística Gap con Error Estándar"
          data={analysis.metrics.map((m) => ({
            k: m.k,
            value: m.gapStatistic,
            err: m.gapStdError,
          }))}
          recommendedK={analysis.gapRecommendedK}
          color="#7c3aed"
          valueDecimals={3}
        />
        <MetricLineChart
          title="4. Índice Calinski-Harabasz (Mayor es mejor)"
          data={analysis.metrics.map((m) => ({ k: m.k, value: m.calinskiHarabasz }))}
          recommendedK={analysis.calinskiRecommendedK}
          color="#0891b2"
          valueDecimals={1}
        />
        <MetricLineChart
          title="5. Índice Davies-Bouldin (Menor es mejor)"
          data={analysis.metrics.map((m) => ({ k: m.k, value: m.daviesBouldin }))}
          recommendedK={analysis.daviesRecommendedK}
          color="#d97706"
          valueDecimals={3}
        />
      </div>

      {/* Comparative Table of Methods */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-900">
            Tabla Comparativa de Métodos y Recomendaciones
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                <th className="px-3 py-2.5 text-left font-semibold">Método</th>
                <th className="px-3 py-2.5 text-center font-semibold">k Sugerido</th>
                <th className="px-3 py-2.5 text-left font-semibold">Qué mide</th>
                <th className="px-3 py-2.5 text-left font-semibold">Cómo se interpreta</th>
                <th className="px-3 py-2.5 text-left font-semibold">Limitaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comparisonRows.map((row) => (
                <tr key={row.method} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                    {row.method}
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono font-bold text-blue-700 tabular-nums">
                    k = {row.kRec}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">{row.measures}</td>
                  <td className="px-3 py-2.5 text-slate-700">{row.interpret}</td>
                  <td className="px-3 py-2.5 text-slate-600">{row.limits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Metrics per K */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-900">
            Detalle Numérico por Cantidad de Clusters (k)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                <th className="px-3 py-2 text-left font-mono">k</th>
                <th className="px-3 py-2 text-right font-semibold">Inercia (WCSS)</th>
                <th className="px-3 py-2 text-right font-semibold">Silueta</th>
                <th className="px-3 py-2 text-right font-semibold">Gap (±SE)</th>
                <th className="px-3 py-2 text-right font-semibold">Calinski-Harabasz</th>
                <th className="px-3 py-2 text-right font-semibold">Davies-Bouldin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analysis.metrics.map((m) => (
                <tr key={m.k} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono font-bold text-slate-900 tabular-nums">
                    k = {m.k}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                    {m.inertia.toLocaleString('es-ES', { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-900 font-semibold">
                    {m.silhouette.toFixed(4)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                    {m.gapStatistic.toFixed(3)} (±{m.gapStdError.toFixed(3)})
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                    {m.calinskiHarabasz.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                    {m.daviesBouldin.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   MÓDULO 10. SELECCIÓN DEL NÚMERO DE SEGMENTOS SEGÚN EL NEGOCIO
============================================================================ */
export const Module10BusinessK: React.FC<{
  analysis: OptimalKAnalysis | null;
  prepared: PreparedDataResult;
  context: BusinessContext;
  selectedK: number;
  seed: number;
  onChangeK: (k: number) => void;
  onNext: () => void;
}> = ({ analysis, prepared, context, selectedK, seed, onChangeK, onNext }) => {
  // Quick preview of cluster sizes for selectedK using K-Means
  const sizePreview = useMemo(() => {
    if (prepared.scaledMatrix.length === 0) return [];
    const res = runKMeansRaw(prepared.scaledMatrix, selectedK, seed, 60, 5);
    const counts = Array(selectedK).fill(0);
    res.labels.forEach((l) => {
      if (l >= 0 && l < selectedK) counts[l]++;
    });
    const total = prepared.scaledMatrix.length;
    return counts
      .map((count, idx) => ({
        idx,
        count,
        pct: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [prepared.scaledMatrix, selectedK, seed]);

  const hasMicroSegment = sizePreview.some((s) => s.pct < 5);
  const consensusK = analysis?.consensusRecommendedK ?? 4;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="text-xs font-medium text-blue-700">Módulo 10 · Decisión Gerencial</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Selección del Número Final de Segmentos según el Negocio
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-3xl">
            Combina la evidencia estadística con la interpretabilidad, tamaño operativo de los grupos y capacidad real de ejecución comercial en {context.sector}.
          </p>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Ejecutar Modelo de Clustering
        </button>
      </div>

      {/* Argued Recommendation */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-base font-bold text-slate-900">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span>Recomendación Estadística y de Negocio: k = {consensusK} segmentos</span>
          </div>
          {selectedK !== consensusK && (
            <button
              type="button"
              onClick={() => onChangeK(consensusK)}
              className="rounded-lg border border-blue-700 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 cursor-pointer"
            >
              Aceptar recomendación (k = {consensusK})
            </button>
          )}
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          {analysis ? (
            <>
              Al ponderar Silueta (sugiere k={analysis.silhouetteRecommendedK}), Codo (k={analysis.elbowRecommendedK}), Estadística Gap (k={analysis.gapRecommendedK}), Calinski-Harabasz (k={analysis.calinskiRecommendedK}) y Davies-Bouldin (k={analysis.daviesRecommendedK}), el punto de mayor equilibrio entre separación matemática y gobernabilidad estratégica se ubica en <strong>k = {consensusK}</strong>. Puedes aceptar este valor o ajustarlo según la capacidad operativa de tus equipos.
            </>
          ) : (
            'Ajusta el número final de clusters considerando el equilibrio entre diferenciación estadística y capacidad comercial.'
          )}
        </p>
      </div>

      {/* Selector and Live Balance Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Ajustar número final de segmentos (k)
          </h2>
          <div className="flex flex-wrap gap-2">
            {[2, 3, 4, 5, 6, 7, 8].map((kVal) => (
              <button
                key={kVal}
                type="button"
                onClick={() => onChangeK(kVal)}
                className={`px-4 py-2 rounded-lg text-sm font-mono font-semibold transition-colors cursor-pointer ${
                  selectedK === kVal
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                k = {kVal}
              </button>
            ))}
          </div>

          <div className="pt-2 space-y-2">
            <div className="text-xs font-semibold text-slate-700">
              Vista previa de distribución de tamaños para k = {selectedK}:
            </div>
            {sizePreview.map((item, i) => (
              <div key={item.idx} className="flex items-center gap-3 text-xs">
                <span className="w-24 text-slate-600 font-mono">Grupo #{i + 1}</span>
                <div className="flex-1 h-3 bg-slate-100 rounded overflow-hidden">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${Math.max(2, item.pct)}%`,
                      backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                    }}
                  />
                </div>
                <span className="w-28 text-right font-mono tabular-nums text-slate-800">
                  {item.count} ({item.pct.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>

          {hasMicroSegment && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
              <div>
                Con k = {selectedK} aparece al menos un grupo con menos del 5% de las observaciones. Evalúa si representa un nicho estratégico rentable o una fragmentación excesiva difícil de operar.
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Consecuencias estratégicas de elegir muy pocos o demasiados segmentos
          </h2>
          <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="font-semibold text-slate-900">
                Riesgo de muy pocos segmentos (k = 2 o sub-segmentación)
              </div>
              <p className="mt-1">
                Agrupa realidades heterogéneas bajo promedios artificiales. Se diluyen las diferencias en margen, riesgo o canal, obligando a diseñar estrategias genéricas que desperdician presupuesto en quienes no lo necesitan y desatienden nichos de alta oportunidad.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="font-semibold text-slate-900">
                Riesgo de demasiados segmentos (k ≥ 7 o sobre-segmentación)
              </div>
              <p className="mt-1">
                Produce micro-segmentos con fronteras difusas entre sí y bajo volumen estadístico. Multiplica el costo operativo de crear propuestas de valor, planes comerciales, KPIs y seguimiento diferenciado que la organización rara vez logra ejecutar de forma sostenida.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   MÓDULO 11. EJECUCIÓN DEL MODELO DE CLUSTERING
============================================================================ */
export const Module11Modeling: React.FC<{
  prepared: PreparedDataResult;
  context: BusinessContext;
  params: ClusteringRunParams;
  activeModel: ClusteringModelResult | null;
  onUpdateParams: (patch: Partial<ClusteringRunParams>) => void;
  onRunModel: () => void;
  onNext: () => void;
}> = ({
  prepared,
  context,
  params,
  activeModel,
  onUpdateParams,
  onRunModel,
  onNext,
}) => {
  // Compare algorithms side-by-side deterministically on the same prepared data
  const algorithmComparison = useMemo(() => {
    if (prepared.scaledMatrix.length < 6) return [];
    const suggestedEps = suggestDbscanEps(prepared.scaledMatrix, params.dbscanMinPts);
    const configs: { label: string; runParams: ClusteringRunParams }[] = [
      {
        label: 'K-Means (K-Means++)',
        runParams: { ...params, algorithm: 'kmeans' },
      },
      {
        label: `Jerárquico (${params.hierarchicalLinkage})`,
        runParams: { ...params, algorithm: 'hierarchical' },
      },
      {
        label: 'Gaussian Mixture (GMM)',
        runParams: { ...params, algorithm: 'gmm' },
      },
      {
        label: `DBSCAN (eps=${params.algorithm === 'dbscan' ? params.dbscanEps : suggestedEps})`,
        runParams: {
          ...params,
          algorithm: 'dbscan',
          dbscanEps: params.algorithm === 'dbscan' ? params.dbscanEps : suggestedEps,
        },
      },
    ];

    return configs.map((c) => {
      const res = executeClusteringModel(prepared, c.runParams, context);
      return {
        algorithm: c.runParams.algorithm,
        label: c.label,
        kEffective: res.kEffective,
        noiseCount: res.noiseCount,
        silhouette: res.silhouetteScore,
        calinski: res.calinskiHarabasz,
        davies: res.daviesBouldin,
        bic: res.bic,
      };
    });
  }, [prepared, params, context]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="text-xs font-medium text-blue-700">Módulo 11 · Modelado No Supervisado</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Ejecución del Modelo y Comparación de Algoritmos
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-3xl">
            Ejecuta K-Means++ como referencia base y contrasta con Clustering Jerárquico, Gaussian Mixture Models y DBSCAN con semilla fija para reproducibilidad total.
          </p>
        </div>
        <button
          type="button"
          disabled={!activeModel}
          onClick={onNext}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
        >
          Continuar a Análisis de Centroides
        </button>
      </div>

      {/* Controls Panel */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Algoritmo principal
            </label>
            <select
              value={params.algorithm}
              onChange={(e) =>
                onUpdateParams({ algorithm: e.target.value as ClusteringAlgorithm })
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
            >
              <option value="kmeans">K-Means (K-Means++)</option>
              <option value="hierarchical">Clustering Jerárquico Aglomerativo</option>
              <option value="gmm">Gaussian Mixture Model (GMM)</option>
              <option value="dbscan">DBSCAN (Basado en densidad)</option>
            </select>
          </div>

          {params.algorithm !== 'dbscan' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Número de clusters (k)
              </label>
              <input
                type="number"
                min={2}
                max={10}
                value={params.k}
                onChange={(e) =>
                  onUpdateParams({ k: Math.max(2, Math.min(10, Number(e.target.value))) })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Radio eps
                </label>
                <input
                  type="number"
                  step="0.05"
                  min={0.05}
                  value={params.dbscanEps}
                  onChange={(e) =>
                    onUpdateParams({ dbscanEps: Math.max(0.05, Number(e.target.value)) })
                  }
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono tabular-nums text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  MinPts
                </label>
                <input
                  type="number"
                  min={2}
                  max={30}
                  value={params.dbscanMinPts}
                  onChange={(e) =>
                    onUpdateParams({ dbscanMinPts: Math.max(2, Number(e.target.value)) })
                  }
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono tabular-nums text-slate-900"
                />
              </div>
            </div>
          )}

          {params.algorithm === 'hierarchical' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Criterio de enlace (Linkage)
              </label>
              <select
                value={params.hierarchicalLinkage}
                onChange={(e) =>
                  onUpdateParams({
                    hierarchicalLinkage: e.target.value as 'ward' | 'complete' | 'average',
                  })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              >
                <option value="ward">Ward (minimiza varianza)</option>
                <option value="complete">Enlace completo (Complete)</option>
                <option value="average">Enlace promedio (Average)</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Semilla aleatoria (Reproducibilidad)
              </label>
              <input
                type="number"
                value={params.seed}
                onChange={(e) => onUpdateParams({ seed: Number(e.target.value) || 42 })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
              />
            </div>
          )}

          <div className="flex items-end">
            <button
              type="button"
              onClick={onRunModel}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Play className="h-3.5 w-3.5" />
              Ejecutar modelo seleccionado
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Algorithm Benchmark Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-900">
            Comparativa Técnica entre Algoritmos sobre los Mismos Datos Preparados
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                <th className="px-3 py-2.5 text-left font-semibold">Algoritmo</th>
                <th className="px-3 py-2.5 text-right font-semibold">Clusters</th>
                <th className="px-3 py-2.5 text-right font-semibold">Ruido</th>
                <th className="px-3 py-2.5 text-right font-semibold">Silueta (↑)</th>
                <th className="px-3 py-2.5 text-right font-semibold">Calinski-Harabasz (↑)</th>
                <th className="px-3 py-2.5 text-right font-semibold">Davies-Bouldin (↓)</th>
                <th className="px-3 py-2.5 text-right font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {algorithmComparison.map((row) => {
                const isActive = activeModel?.algorithm === row.algorithm;
                return (
                  <tr key={row.algorithm} className={isActive ? 'bg-blue-50/40' : 'hover:bg-slate-50'}>
                    <td className="px-3 py-2.5 font-semibold text-slate-900">
                      {row.label}
                      {isActive && (
                        <span className="ml-2 text-[11px] font-medium text-blue-700">
                          (Modelo Activo)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.kEffective}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.noiseCount}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {row.silhouette.toFixed(4)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.calinski.toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.davies.toFixed(4)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onUpdateParams({ algorithm: row.algorithm })}
                        className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                      >
                        Seleccionar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Model Visualization & Sizes */}
      {activeModel && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Mapa de Segmentos en Componentes Principales (PCA 2D)
              </h2>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                Varianza explicada: PC1 ({activeModel.pcaExplainedVariance[0]}%) + PC2 ({activeModel.pcaExplainedVariance[1]}%)
              </span>
            </div>

            <ScatterPlot2D
              points={activeModel.pcaPoints.map((pt) => ({
                x: pt.pc1,
                y: pt.pc2,
                clusterId: pt.clusterId,
                label: `Fila #${pt.rowIndex + 1} · ${
                  activeModel.clusterSummaries.find((s) => s.clusterId === pt.clusterId)
                    ?.strategicName ?? ''
                }`,
              }))}
              centroids={activeModel.pcaCentroids.map((c) => ({
                x: c.pc1,
                y: c.pc2,
                clusterId: c.clusterId,
              }))}
              xLabel={`Componente Principal 1 (${activeModel.pcaExplainedVariance[0]}%)`}
              yLabel={`Componente Principal 2 (${activeModel.pcaExplainedVariance[1]}%)`}
              height={340}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Distribución del Modelo Activo
            </h2>
            <div className="space-y-2.5">
              {activeModel.clusterSummaries.map((s) => {
                const color =
                  s.clusterId === -1
                    ? '#64748b'
                    : SEGMENT_COLORS[s.clusterId % SEGMENT_COLORS.length];
                return (
                  <div key={s.clusterId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 truncate pr-2" title={s.strategicName}>
                        {s.strategicName}
                      </span>
                      <span className="font-mono tabular-nums text-slate-700 shrink-0">
                        {s.count} ({s.percentage}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{ width: `${Math.max(2, s.percentage)}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
              <div className="font-semibold text-slate-900">
                Registro de Reproducibilidad
              </div>
              <div className="text-slate-600 font-mono text-[11px] space-y-0.5 tabular-nums">
                <div>Algoritmo: {activeModel.parametersLog.algorithm}</div>
                <div>Clusters efectivos: {activeModel.parametersLog.k}</div>
                <div>Semilla (seed): {activeModel.parametersLog.seed}</div>
                <div>Escalamiento: {activeModel.parametersLog.scaling}</div>
                <div>Parámetros: {activeModel.parametersLog.extraParams}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
