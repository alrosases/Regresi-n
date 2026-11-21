import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Layers,
  Plus,
  Table as TableIcon,
} from 'lucide-react';
import {
  CentroidProfileChart,
  ImpactEffortMatrixChart,
  ScatterPlot2D,
} from '../Charts';
import { SEGMENT_COLORS } from '../../engine/clustering';
import {
  exportCentroidsCsv,
  exportCompleteExcelWorkbook,
  exportDatasetWithClustersCsv,
  exportExecutivePdfReport,
  exportProcessedDatasetCsv,
} from '../../engine/exporters';
import { classifyQuadrant } from '../../engine/interpretationAndStrategy';
import type {
  BusinessContext,
  BusinessStrategy,
  ClusteringModelResult,
  DescriptiveStats,
  OptimalKAnalysis,
  ParsedDataset,
  PreparedDataResult,
  SegmentProfile,
} from '../../types/segmentation';

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1000) return n.toLocaleString('es-ES', { maximumFractionDigits: 1 });
  return n.toLocaleString('es-ES', { maximumFractionDigits: 2 });
}

/* ============================================================================
   MÓDULO 12. ANÁLISIS E INTERPRETACIÓN DE CENTROIDES
============================================================================ */
export const Module12Centroids: React.FC<{
  model: ClusteringModelResult;
  variables: string[];
  globalStats: DescriptiveStats[];
  onRenameSegment: (clusterId: number, newName: string) => void;
  onNext: () => void;
}> = ({ model, variables, globalStats, onRenameSegment, onNext }) => {
  const globalMeanMap = new Map(globalStats.map((s) => [s.variable, s.mean]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="text-xs font-medium text-blue-700">Módulo 12 · Lectura de Centroides</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Centroides Estandarizados y Valores Reales de Negocio
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-3xl">
            Doble lectura complementaria: los centroides estandarizados (Z-score) revelan qué variables diferencian estadísticamente a cada grupo, mientras los centroides en unidades originales traducen cada segmento a magnitudes reales del negocio y dan origen a su nombre estratégico.
          </p>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Continuar a Perfiles de Segmentos
        </button>
      </div>

      {/* Perspective A: Standardized Centroids + Visual Diverging Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Perspectiva A. Centroides Estandarizados (Diferencias Relativas en Desviaciones Z)
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Valores positivos (Z &gt; 0) indican un promedio por encima del total general; valores negativos (Z &lt; 0) indican un promedio inferior. Desviaciones con |Z| ≥ 0.45 definen los rasgos distintivos del segmento.
          </p>
        </div>

        <CentroidProfileChart summaries={model.clusterSummaries} variables={variables} />

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-3 py-2 text-left font-semibold">Segmento Estratégico</th>
                <th className="px-3 py-2 text-right font-semibold">N (%)</th>
                {variables.map((v) => (
                  <th key={v} className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                    Z · {v}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {model.clusterSummaries.map((s) => (
                <tr key={s.clusterId} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-semibold text-slate-900 whitespace-nowrap">
                    {s.strategicName}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                    {s.count} ({s.percentage}%)
                  </td>
                  {variables.map((v) => {
                    const z = s.standardizedCentroid[v] ?? 0;
                    return (
                      <td
                        key={v}
                        className={`px-3 py-2 text-right font-mono tabular-nums ${
                          z >= 0.45
                            ? 'text-blue-800 font-bold bg-blue-50/40'
                            : z <= -0.45
                              ? 'text-amber-800 font-bold bg-amber-50/40'
                              : 'text-slate-700'
                        }`}
                      >
                        {z >= 0 ? '+' : ''}
                        {z.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Perspective B: Original Business-Unit Centroids + Naming */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Perspectiva B. Centroides en Unidades Originales del Negocio
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Promedios reales por segmento en sus unidades de origen (junto con el promedio global de referencia). Los nombres estratégicos se construyeron automáticamente a partir de estos centroides y puedes ajustarlos aquí si lo deseas.
          </p>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-3 py-2.5 text-left font-semibold min-w-[240px]">
                  Nombre Estratégico (Editable)
                </th>
                <th className="px-3 py-2.5 text-right font-semibold">Tamaño</th>
                {variables.map((v) => (
                  <th key={v} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                    {v}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-slate-50/80 text-slate-600 font-medium">
                <td className="px-3 py-2">Referencia Promedio Global</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">100%</td>
                {variables.map((v) => (
                  <td key={v} className="px-3 py-2 text-right font-mono tabular-nums">
                    {fmt(globalMeanMap.get(v) ?? 0)}
                  </td>
                ))}
              </tr>
              {model.clusterSummaries.map((s) => {
                const color =
                  s.clusterId === -1
                    ? '#64748b'
                    : SEGMENT_COLORS[s.clusterId % SEGMENT_COLORS.length];
                return (
                  <tr key={s.clusterId} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-xs shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <input
                          type="text"
                          value={s.strategicName}
                          onChange={(e) => onRenameSegment(s.clusterId, e.target.value)}
                          className="w-full rounded border border-transparent hover:border-slate-300 focus:border-blue-600 bg-transparent px-1.5 py-1 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {s.count} ({s.percentage}%)
                    </td>
                    {variables.map((v) => (
                      <td
                        key={v}
                        className="px-3 py-2 text-right font-mono tabular-nums font-medium text-slate-900"
                      >
                        {fmt(s.originalCentroid[v] ?? 0)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   MÓDULO 13. CONSTRUCCIÓN DE PERFILES DE SEGMENTOS
============================================================================ */
export const Module13Profiles: React.FC<{
  profiles: SegmentProfile[];
  onNext: () => void;
}> = ({ profiles, onNext }) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="text-xs font-medium text-blue-700">Módulo 13 · Inteligencia de Segmentos</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Perfiles Completos y Comparativa entre Segmentos
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-3xl">
            Ficha integral de cada segmento derivada exclusivamente de los resultados reales de los centroides, dispersión y contexto operativo.
          </p>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Continuar a Estrategias de Negocio
        </button>
      </div>

      {/* Profiles Grid */}
      <div className="space-y-5">
        {profiles.map((p) => (
          <div
            key={p.clusterId}
            className="rounded-xl border border-slate-200 bg-white p-6 space-y-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span
                  className="h-4 w-4 rounded-sm shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{p.strategicName}</h2>
                  <div className="mt-0.5 text-xs font-mono text-slate-600 tabular-nums">
                    {p.count.toLocaleString('es-ES')} registros · Participación: {p.percentage}% del total
                  </div>
                </div>
              </div>
            </div>

            {/* Differentiating variables strip */}
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-2">
                Variables que lo diferencian (Media del segmento vs Promedio global)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {p.differentiatingVariables.slice(0, 4).map((dv) => (
                  <div
                    key={dv.variable}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"
                  >
                    <div className="text-[11px] font-medium text-slate-600 truncate" title={dv.variable}>
                      {dv.variable}
                    </div>
                    <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
                      <span className="text-sm font-bold text-slate-900">
                        {fmt(dv.clusterMean)}
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          dv.direction === 'alto'
                            ? 'text-blue-700'
                            : dv.direction === 'bajo'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {dv.pctDiffFromGlobal >= 0 ? '+' : ''}
                        {dv.pctDiffFromGlobal}% (Z={dv.zScore >= 0 ? '+' : ''}{dv.zScore.toFixed(2)})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Structured 12-dimension details */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs leading-relaxed">
              <div className="space-y-1">
                <div className="font-semibold text-slate-900">Características principales</div>
                <ul className="list-disc pl-4 text-slate-600 space-y-1">
                  {p.mainCharacteristics.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-slate-900">Fortalezas</div>
                <ul className="list-disc pl-4 text-slate-600 space-y-1">
                  {p.strengths.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-slate-900">Debilidades</div>
                <ul className="list-disc pl-4 text-slate-600 space-y-1">
                  {p.weaknesses.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-slate-900">Necesidades</div>
                <ul className="list-disc pl-4 text-slate-600 space-y-1">
                  {p.needs.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="font-semibold text-slate-900">Comportamiento</div>
                  <p className="text-slate-600 mt-0.5">{p.behavior}</p>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Potencial de crecimiento</div>
                  <p className="text-slate-600 mt-0.5">{p.growthPotential}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="font-semibold text-slate-900">Riesgos</div>
                  <ul className="list-disc pl-4 text-slate-600 space-y-1 mt-0.5">
                    {p.risks.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Oportunidades comerciales</div>
                  <ul className="list-disc pl-4 text-slate-600 space-y-1 mt-0.5">
                    {p.commercialOpportunities.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ============================================================================
   MÓDULO 14. ESTRATEGIAS DE NEGOCIO NO OBVIAS
============================================================================ */
export const Module14Strategies: React.FC<{
  strategies: BusinessStrategy[];
  profiles: SegmentProfile[];
  onUpdateStrategy: (id: string, patch: Partial<BusinessStrategy>) => void;
  onAddStrategy: (strategy: BusinessStrategy) => void;
  onNext: () => void;
}> = ({ strategies, profiles, onUpdateStrategy, onAddStrategy, onNext }) => {
  const [filterCluster, setFilterCluster] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClusterId, setNewClusterId] = useState<number>(profiles[0]?.clusterId ?? 0);
  const [newAxis, setNewAxis] = useState('Innovación en Producto / Monetización');
  const [newProblem, setNewProblem] = useState('');
  const [newStrategyText, setNewStrategyText] = useState('');
  const [newKpi, setNewKpi] = useState('');

  const filtered =
    filterCluster === 'all'
      ? strategies
      : strategies.filter((s) => String(s.clusterId) === filterCluster);

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStrategyText.trim()) return;
    const prof = profiles.find((p) => p.clusterId === newClusterId);
    const impact = 7;
    const effort = 5;
    onAddStrategy({
      id: `strat-custom-${Date.now()}`,
      clusterId: newClusterId,
      segmentName: prof?.strategicName ?? 'Segmento',
      strategicAxis: newAxis,
      problemOrOpportunity: newProblem || 'Oportunidad estratégica definida por el equipo directivo.',
      dataEvidence: prof?.mainCharacteristics[0] ?? 'Evidencia basada en centroides del segmento.',
      proposedStrategy: newStrategyText,
      implementationMechanism: 'Piloto controlado con medición comparativa frente a grupo de control.',
      expectedImpact: 'Mejora direccionada en contribución neta del segmento sin supuestos no verificados.',
      kpi: newKpi || 'Margen neto / Tasa de retención del segmento',
      risksAndAssumptions: 'Validar supuestos operativos antes de despliegue general.',
      horizon: 'Mediano plazo (3-9 meses)',
      impactScore: impact,
      effortScore: effort,
      quadrant: classifyQuadrant(impact, effort),
      suggestedOwner: 'Dirección de Negocio',
      scoringRationale: 'Iniciativa personalizada por el usuario (Impacto 7/10 · Esfuerzo 5/10).',
    });
    setNewProblem('');
    setNewStrategyText('');
    setNewKpi('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="text-xs font-medium text-blue-700">Módulo 14 · Consultoría Estratégica</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Estrategias Diferenciadas Basadas en Evidencia
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-3xl">
            Iniciativas no genéricas conectadas directamente con las desviaciones reales de cada segmento (arquitectura de precios, costo de atención, retención estructural, alianzas y rediseño de canales) sin inventar cifras financieras.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar estrategia
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Continuar a Matriz Impacto y Esfuerzo
          </button>
        </div>
      </div>

      {/* Segment Filter Bar */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-200/60 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setFilterCluster('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            filterCluster === 'all'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Todos los segmentos ({strategies.length})
        </button>
        {profiles.map((p) => (
          <button
            key={p.clusterId}
            type="button"
            onClick={() => setFilterCluster(String(p.clusterId))}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer max-w-[220px] truncate ${
              filterCluster === String(p.clusterId)
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {p.strategicName}
          </button>
        ))}
      </div>

      {showAddForm && (
        <form
          onSubmit={handleCreateCustom}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-slate-900">
            Nueva Iniciativa Estratégica Personalizada
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Segmento objetivo</label>
              <select
                value={newClusterId}
                onChange={(e) => setNewClusterId(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
              >
                {profiles.map((p) => (
                  <option key={p.clusterId} value={p.clusterId}>
                    {p.strategicName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Eje estratégico</label>
              <input
                type="text"
                value={newAxis}
                onChange={(e) => setNewAxis(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Problema u oportunidad</label>
              <input
                type="text"
                value={newProblem}
                onChange={(e) => setNewProblem(e.target.value)}
                placeholder="Brecha identificada en los datos..."
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Indicador KPI</label>
              <input
                type="text"
                value={newKpi}
                onChange={(e) => setNewKpi(e.target.value)}
                placeholder="Ej. Margen de contribución neta del segmento"
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">Estrategia propuesta</label>
              <textarea
                rows={2}
                required
                value={newStrategyText}
                onChange={(e) => setNewStrategyText(e.target.value)}
                placeholder="Describe el mecanismo concreto de monetización, eficiencia o fidelización..."
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-medium text-white cursor-pointer"
            >
              Guardar estrategia
            </button>
          </div>
        </form>
      )}

      {/* Strategy Cards */}
      <div className="space-y-4">
        {filtered.map((st, idx) => {
          const color =
            st.clusterId === -1
              ? '#64748b'
              : SEGMENT_COLORS[st.clusterId % SEGMENT_COLORS.length];
          return (
            <div
              key={st.id}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-start gap-2.5">
                  <span
                    className="mt-1 h-3.5 w-3.5 rounded-xs shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <div>
                    <div className="text-xs text-slate-500">
                      #{idx + 1} · {st.segmentName} · {st.horizon}
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{st.strategicAxis}</h3>
                  </div>
                </div>
                <div className="text-xs font-mono text-slate-700 tabular-nums">
                  Impacto {st.impactScore}/10 · Esfuerzo {st.effortScore}/10 · {st.quadrant}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                <div>
                  <div className="font-semibold text-slate-900">Problema u oportunidad identificada</div>
                  <p className="mt-0.5 text-slate-700">{st.problemOrOpportunity}</p>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Evidencia encontrada en los datos</div>
                  <p className="mt-0.5 font-mono text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                    {st.dataEvidence}
                  </p>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Estrategia propuesta</div>
                  <textarea
                    rows={2}
                    value={st.proposedStrategy}
                    onChange={(e) =>
                      onUpdateStrategy(st.id, { proposedStrategy: e.target.value })
                    }
                    className="mt-1 w-full rounded border border-slate-200 bg-slate-50/50 p-2 text-xs text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Mecanismo de implementación</div>
                  <textarea
                    rows={2}
                    value={st.implementationMechanism}
                    onChange={(e) =>
                      onUpdateStrategy(st.id, { implementationMechanism: e.target.value })
                    }
                    className="mt-1 w-full rounded border border-slate-200 bg-slate-50/50 p-2 text-xs text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Impacto esperado (direccional)</div>
                  <p className="mt-0.5 text-slate-700">{st.expectedImpact}</p>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Indicador KPI</div>
                  <input
                    type="text"
                    value={st.kpi}
                    onChange={(e) => onUpdateStrategy(st.id, { kpi: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-200 bg-slate-50/50 px-2 py-1 text-xs text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Riesgos y supuestos</div>
                  <p className="mt-0.5 text-slate-600">{st.risksAndAssumptions}</p>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Horizonte y responsable sugerido</div>
                  <p className="mt-0.5 text-slate-700">
                    {st.horizon} · {st.suggestedOwner}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ============================================================================
   MÓDULO 15. MATRIZ DE IMPACTO Y ESFUERZO
============================================================================ */
export const Module15Matrix: React.FC<{
  strategies: BusinessStrategy[];
  onUpdateStrategy: (id: string, patch: Partial<BusinessStrategy>) => void;
  onNext: () => void;
}> = ({ strategies, onUpdateStrategy, onNext }) => {
  const [selectedId, setSelectedId] = useState<string>(strategies[0]?.id ?? '');

  const quadrantCounts = {
    q1: strategies.filter((s) => s.quadrant === 'Alto Impacto / Bajo Esfuerzo').length,
    q2: strategies.filter((s) => s.quadrant === 'Alto Impacto / Alto Esfuerzo').length,
    q3: strategies.filter((s) => s.quadrant === 'Bajo Impacto / Bajo Esfuerzo').length,
    q4: strategies.filter((s) => s.quadrant === 'Bajo Impacto / Alto Esfuerzo').length,
  };

  const handleScoreChange = (st: BusinessStrategy, impactScore: number, effortScore: number) => {
    onUpdateStrategy(st.id, {
      impactScore,
      effortScore,
      quadrant: classifyQuadrant(impactScore, effortScore),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="text-xs font-medium text-blue-700">Módulo 15 · Priorización Ejecutiva</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Matriz de Impacto y Esfuerzo (4 Cuadrantes) y Hoja de Ruta
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-3xl">
            Clasifica y calibra cada estrategia según su impacto esperado en el negocio y el esfuerzo operativo/técnico requerido para construir una secuencia ejecutable.
          </p>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Ver Dashboard Ejecutivo
        </button>
      </div>

      {/* Quadrant Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="font-bold text-emerald-900">Cuadrante 1 · Prioritarias</div>
          <div className="mt-0.5 text-emerald-800">Alto Impacto / Bajo Esfuerzo</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-900">
            {quadrantCounts.q1}
          </div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
          <div className="font-bold text-blue-900">Cuadrante 2 · Estratégicas</div>
          <div className="mt-0.5 text-blue-800">Alto Impacto / Alto Esfuerzo</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-blue-900">
            {quadrantCounts.q2}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="font-bold text-slate-900">Cuadrante 3 · Complementarias</div>
          <div className="mt-0.5 text-slate-600">Bajo Impacto / Bajo Esfuerzo</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {quadrantCounts.q3}
          </div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50/40 p-4">
          <div className="font-bold text-red-900">Cuadrante 4 · Reconsiderar</div>
          <div className="mt-0.5 text-red-800">Bajo Impacto / Alto Esfuerzo</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-red-900">
            {quadrantCounts.q4}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Visualización de Cuadrantes (Haz clic en un punto para inspeccionar)
          </h2>
          <ImpactEffortMatrixChart
            strategies={strategies}
            selectedId={selectedId}
            onSelectStrategy={(s) => setSelectedId(s.id)}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 text-xs">
          <h2 className="text-sm font-semibold text-slate-900">
            Criterios Explícitos de Calificación
          </h2>
          <div className="space-y-2.5 text-slate-600 leading-relaxed">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="font-semibold text-slate-900">Impacto (1–10, umbral alto ≥ 6)</div>
              <p className="mt-1">
                Ponderado por la participación porcentual del segmento en la base, la magnitud de la brecha medida en Z-score respecto al promedio y la urgencia del riesgo o captura de margen.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="font-semibold text-slate-900">Esfuerzo (1–10, umbral alto ≥ 6)</div>
              <p className="mt-1">
                Evalúa complejidad tecnológica o contractual, cantidad de áreas involucradas, costo de implementación y tiempo hasta el primer resultado medible.
              </p>
            </div>
            <p className="text-[11px] text-slate-500">
              Puedes ajustar Impacto, Esfuerzo, Responsable y Plazo directamente en la hoja de ruta inferior para reflejar las restricciones reales de tu organización.
            </p>
          </div>
        </div>
      </div>

      {/* Prioritized Roadmap Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-900">
            Hoja de Ruta Priorizada (Editable)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                <th className="px-3 py-2.5 text-left font-mono">#</th>
                <th className="px-3 py-2.5 text-left font-semibold">Acción / Estrategia</th>
                <th className="px-3 py-2.5 text-left font-semibold">Segmento Objetivo</th>
                <th className="px-3 py-2.5 text-center font-semibold">Impacto</th>
                <th className="px-3 py-2.5 text-center font-semibold">Esfuerzo</th>
                <th className="px-3 py-2.5 text-left font-semibold">Cuadrante</th>
                <th className="px-3 py-2.5 text-left font-semibold">Responsable</th>
                <th className="px-3 py-2.5 text-left font-semibold">Plazo</th>
                <th className="px-3 py-2.5 text-left font-semibold">KPI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {strategies.map((st, idx) => (
                <tr
                  key={st.id}
                  className={selectedId === st.id ? 'bg-blue-50/40' : 'hover:bg-slate-50'}
                >
                  <td className="px-3 py-2.5 font-mono text-slate-500">{idx + 1}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-900 max-w-xs">
                    {st.proposedStrategy}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 max-w-[180px] truncate" title={st.segmentName}>
                    {st.segmentName}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={st.impactScore}
                      onChange={(e) =>
                        handleScoreChange(
                          st,
                          Math.min(10, Math.max(1, Number(e.target.value) || 1)),
                          st.effortScore
                        )
                      }
                      className="w-14 rounded border border-slate-300 px-1.5 py-1 text-center font-mono tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={st.effortScore}
                      onChange={(e) =>
                        handleScoreChange(
                          st,
                          st.impactScore,
                          Math.min(10, Math.max(1, Number(e.target.value) || 1))
                        )
                      }
                      className="w-14 rounded border border-slate-300 px-1.5 py-1 text-center font-mono tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-2.5 font-semibold whitespace-nowrap text-slate-800">
                    {st.quadrant}
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="text"
                      value={st.suggestedOwner}
                      onChange={(e) =>
                        onUpdateStrategy(st.id, { suggestedOwner: e.target.value })
                      }
                      className="w-40 rounded border border-slate-200 px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={st.horizon}
                      onChange={(e) =>
                        onUpdateStrategy(st.id, {
                          horizon: e.target.value as BusinessStrategy['horizon'],
                        })
                      }
                      className="rounded border border-slate-200 px-2 py-1 text-xs"
                    >
                      <option value="Corto plazo (0-3 meses)">Corto plazo (0-3 meses)</option>
                      <option value="Mediano plazo (3-9 meses)">Mediano plazo (3-9 meses)</option>
                      <option value="Largo plazo (9-18 meses)">Largo plazo (9-18 meses)</option>
                    </select>
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 max-w-[200px]">{st.kpi}</td>
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
   MÓDULO 16. DASHBOARD EJECUTIVO
============================================================================ */
export const Module16Dashboard: React.FC<{
  dataset: ParsedDataset;
  context: BusinessContext;
  prepared: PreparedDataResult;
  model: ClusteringModelResult;
  profiles: SegmentProfile[];
  strategies: BusinessStrategy[];
  onGoToExport: () => void;
}> = ({
  dataset,
  context,
  prepared,
  model,
  profiles,
  strategies,
  onGoToExport,
}) => {
  const priorityStrategies = strategies
    .filter((s) => s.quadrant === 'Alto Impacto / Bajo Esfuerzo')
    .sort((a, b) => b.impactScore - a.effortScore);

  const topQuickWins =
    priorityStrategies.length > 0
      ? priorityStrategies
      : strategies
          .slice()
          .sort((a, b) => b.impactScore - a.effortScore - (a.impactScore - a.effortScore))
          .slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="text-xs font-medium text-blue-700">Módulo 16 · Síntesis Directiva</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Dashboard Ejecutivo de Segmentación y Decisiones
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            {context.sector} · Unidad: {context.observationUnit} · Fuente: {dataset.fileName}
          </p>
        </div>
        <button
          type="button"
          onClick={onGoToExport}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="h-4 w-4" />
          Exportar Resultados e Informes
        </button>
      </div>

      {/* Top KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Registros modelados</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {prepared.activeRowIndices.length.toLocaleString('es-ES')}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 font-mono tabular-nums">
            de {dataset.rows.length.toLocaleString('es-ES')} totales
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Variables utilizadas</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {prepared.variables.length}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {prepared.scalingMethod === 'minmax' ? 'Min-Max [0,1]' : 'Z-score'}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Segmentos finales</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-blue-700">
            {model.kEffective}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 truncate">{model.algorithmLabel}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Coeficiente de Silueta</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {model.silhouetteScore.toFixed(3)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 font-mono tabular-nums">
            DB: {model.daviesBouldin.toFixed(3)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Acciones prioritarias (C1)</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {priorityStrategies.length}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            de {strategies.length} estrategias
          </div>
        </div>
      </div>

      {/* Segment Share Proportional Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
          <span>1. ¿Qué segmentos existen y qué participación tienen?</span>
          <span className="text-xs font-normal text-slate-500">
            Proporción de {prepared.activeRowIndices.length} registros
          </span>
        </div>
        <div className="h-6 w-full rounded-lg overflow-hidden flex border border-slate-200">
          {model.clusterSummaries.map((s) => {
            const color =
              s.clusterId === -1
                ? '#64748b'
                : SEGMENT_COLORS[s.clusterId % SEGMENT_COLORS.length];
            return (
              <div
                key={s.clusterId}
                style={{ width: `${s.percentage}%`, backgroundColor: color }}
                title={`${s.strategicName}: ${s.count} (${s.percentage}%)`}
                className="h-full flex items-center justify-center text-[11px] font-mono font-bold text-white truncate px-1"
              >
                {s.percentage >= 8 ? `${s.percentage}%` : ''}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
          {model.clusterSummaries.map((s) => {
            const color =
              s.clusterId === -1
                ? '#64748b'
                : SEGMENT_COLORS[s.clusterId % SEGMENT_COLORS.length];
            return (
              <div key={s.clusterId} className="flex items-center gap-2 text-xs">
                <span className="h-3 w-3 rounded-xs shrink-0" style={{ backgroundColor: color }} />
                <span className="font-medium text-slate-800 truncate">{s.strategicName}</span>
                <span className="ml-auto font-mono tabular-nums text-slate-600 shrink-0">
                  {s.count} ({s.percentage}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* PCA Map + Centroid Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Visualización Multivariada de Segmentos (PCA 2D)
          </h2>
          <ScatterPlot2D
            points={model.pcaPoints.map((pt) => ({
              x: pt.pc1,
              y: pt.pc2,
              clusterId: pt.clusterId,
              label:
                model.clusterSummaries.find((s) => s.clusterId === pt.clusterId)
                  ?.strategicName ?? '',
            }))}
            centroids={model.pcaCentroids.map((c) => ({
              x: c.pc1,
              y: c.pc2,
              clusterId: c.clusterId,
            }))}
            xLabel={`PC1 (${model.pcaExplainedVariance[0]}%)`}
            yLabel={`PC2 (${model.pcaExplainedVariance[1]}%)`}
            height={290}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            2. ¿Qué diferencia a cada segmento? (Perfil Relativo Z-score)
          </h2>
          <div className="max-h-[310px] overflow-y-auto pr-1">
            <CentroidProfileChart
              summaries={model.clusterSummaries}
              variables={prepared.variables}
            />
          </div>
        </div>
      </div>

      {/* Value & Opportunity per Segment */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          3. ¿Qué valor y oportunidad representa cada segmento para el negocio?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {profiles.map((p) => (
            <div key={p.clusterId} className="rounded-lg border border-slate-200 p-4 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <span className="h-3 w-3 rounded-xs" style={{ backgroundColor: p.color }} />
                <span>{p.strategicName}</span>
                <span className="ml-auto font-mono text-slate-500">{p.percentage}%</span>
              </div>
              <p className="text-slate-700">{p.growthPotential}</p>
              <p className="text-slate-600">{p.commercialOpportunities[0]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Strategies + Impact-Effort Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            4 y 5. Estrategias Prioritarias según Impacto y Esfuerzo
          </h2>
          <div className="space-y-3">
            {topQuickWins.slice(0, 5).map((st) => (
              <div
                key={st.id}
                className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{st.segmentName}</span>
                  <span className="font-mono text-emerald-700 font-semibold tabular-nums">
                    Imp {st.impactScore} / Esf {st.effortScore}
                  </span>
                </div>
                <div className="font-medium text-blue-800">{st.strategicAxis}</div>
                <p className="text-slate-700">{st.proposedStrategy}</p>
                <div className="text-[11px] text-slate-500">
                  KPI: {st.kpi} · Plazo: {st.horizon}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Mapa de Priorización Impacto vs Esfuerzo
          </h2>
          <ImpactEffortMatrixChart strategies={strategies} />
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   MÓDULO 17. EXPORTACIÓN DE RESULTADOS
============================================================================ */
export const Module17Export: React.FC<{
  dataset: ParsedDataset;
  context: BusinessContext;
  prepared: PreparedDataResult;
  descriptiveStats: DescriptiveStats[];
  optimalK: OptimalKAnalysis | null;
  model: ClusteringModelResult;
  profiles: SegmentProfile[];
  strategies: BusinessStrategy[];
}> = ({
  dataset,
  context,
  prepared,
  descriptiveStats,
  optimalK,
  model,
  profiles,
  strategies,
}) => {
  const [lastExported, setLastExported] = useState<string | null>(null);

  const notify = (label: string, fn: () => void) => {
    fn();
    setLastExported(label);
  };

  const exportItems = [
    {
      title: 'Informe Ejecutivo Completo en PDF',
      desc: 'Documento ejecutivo listo para dirección con resumen de metodología, tabla de centroides, perfiles de segmentos, estrategias y hoja de ruta priorizada.',
      format: 'PDF (.pdf)',
      icon: FileText,
      action: () =>
        notify('Informe Ejecutivo PDF', () =>
          exportExecutivePdfReport({
            dataset,
            context,
            prepared,
            descriptiveStats,
            model,
            profiles,
            strategies,
          })
        ),
      primary: true,
    },
    {
      title: 'Libro Integral en Excel Multi-Hoja',
      desc: 'Archivo .xlsx con 8 hojas: Resumen Ejecutivo, Estadísticas Descriptivas, Centroides, Perfiles, Estrategias y Matriz, Evaluación K Óptimo, Datos Segmentados y Trazabilidad.',
      format: 'Excel (.xlsx)',
      icon: FileSpreadsheet,
      action: () =>
        notify('Libro Integral Excel (.xlsx)', () =>
          exportCompleteExcelWorkbook({
            dataset,
            context,
            prepared,
            descriptiveStats,
            optimalK,
            model,
            profiles,
            strategies,
          })
        ),
      primary: true,
    },
    {
      title: 'Dataset Original con Segmento Asignado',
      desc: 'Conserva todas las columnas originales del archivo cargado e incorpora cluster_id y segmento_estrategico para activar campañas o reglas en CRM/ERP.',
      format: 'CSV (.csv)',
      icon: TableIcon,
      action: () =>
        notify('Dataset Original Segmentado (CSV)', () =>
          exportDatasetWithClustersCsv(dataset, prepared, model)
        ),
      primary: false,
    },
    {
      title: 'Dataset Procesado, Escalado y Coordenadas PCA',
      desc: 'Matriz limpia tras imputación/transformaciones, valores escalados (Min-Max o Z-score), componentes PC1/PC2 y etiqueta final.',
      format: 'CSV (.csv)',
      icon: Layers,
      action: () =>
        notify('Dataset Procesado y Escalado (CSV)', () =>
          exportProcessedDatasetCsv(prepared, model)
        ),
      primary: false,
    },
    {
      title: 'Tabla Comparativa de Centroides',
      desc: 'Medias y medianas en unidades originales del negocio junto con los centroides estandarizados (Z-score) de cada segmento.',
      format: 'CSV (.csv)',
      icon: TableIcon,
      action: () =>
        notify('Tabla de Centroides (CSV)', () =>
          exportCentroidsCsv(model, prepared.variables)
        ),
      primary: false,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <div className="text-xs font-medium text-blue-700">Módulo 17 · Entregables y Activación</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Exportación de Datos, Informes y Trazabilidad
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 max-w-3xl">
          Descarga los datasets etiquetados, matrices estadísticas, perfiles, estrategias y matriz de impacto-esfuerzo para activar decisiones en tus sistemas operativos o presentar a directorio.
        </p>
      </div>

      {lastExported && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
          Descarga generada correctamente: <strong>{lastExported}</strong>.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exportItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-mono text-slate-500">{item.format}</div>
                  <h2 className="text-sm font-bold text-slate-900">{item.title}</h2>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                </div>
              </div>
              <div>
                <button
                  type="button"
                  onClick={item.action}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    item.primary
                      ? 'bg-blue-700 text-white hover:bg-blue-800'
                      : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <Download className="h-3.5 w-3.5" />
                  Descargar {item.format}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
