import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, SlidersHorizontal } from 'lucide-react';
import {
  BoxplotChart,
  CorrelationHeatmap,
  HistogramWithKdeChart,
  ScatterPlot2D,
} from '../Charts';
import { parseNumericValue } from '../../engine/dataDiagnostics';
import type { CorrelationMatrixResult } from '../../engine/variableSelection';
import type {
  BusinessContext,
  BusinessRule,
  DatasetDiagnostics,
  DescriptiveStats,
  DistributionAnalysis,
  MathTransform,
  MissingStrategy,
  OutlierStrategy,
  ParsedDataset,
  PreparedDataResult,
  ScalingMethod,
  VariablePrepConfig,
} from '../../types/segmentation';

function fmt(n: number, dec = 2): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1000) return n.toLocaleString('es-ES', { maximumFractionDigits: 1 });
  return n.toLocaleString('es-ES', { maximumFractionDigits: dec });
}

/* ============================================================================
   MÓDULO 4. SELECCIÓN DE VARIABLES PARA SEGMENTACIÓN
============================================================================ */
export const Module4Variables: React.FC<{
  diagnostics: DatasetDiagnostics;
  selectedVariables: string[];
  correlationResult: CorrelationMatrixResult;
  onToggleVariable: (varName: string) => void;
  onSelectAllRecommended: () => void;
  onNext: () => void;
}> = ({
  diagnostics,
  selectedVariables,
  correlationResult,
  onToggleVariable,
  onSelectAllRecommended,
  onNext,
}) => {
  const numericCols = diagnostics.columnDiagnostics.filter(
    (c) =>
      c.inferredType === 'Numérico decimal' ||
      c.inferredType === 'Numérico entero'
  );
  const nonNumericCols = diagnostics.columnDiagnostics.filter(
    (c) =>
      c.inferredType !== 'Numérico decimal' &&
      c.inferredType !== 'Numérico entero'
  );

  const canProceed = selectedVariables.length >= 2;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="text-xs font-medium text-blue-700">Módulo 04 · Ingeniería de Atributos</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Selección de Variables y Análisis de Colinealidad
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-3xl">
            Separa variables continuas de identificadores o discretas, evalúa valores faltantes y revisa correlaciones y VIF para evitar que dimensiones redundantes dominen la distancia del modelo.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSelectAllRecommended}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Restaurar candidatas sugeridas
          </button>
          <button
            type="button"
            disabled={!canProceed}
            onClick={onNext}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continuar a Estadísticas Descriptivas
          </button>
        </div>
      </div>

      {!canProceed && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-900">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
          <div>
            Debes seleccionar al menos <strong>2 variables numéricas</strong> para ejecutar clustering multivariado. Actualmente seleccionadas: {selectedVariables.length}.
          </div>
        </div>
      )}

      {/* Numeric selection table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Variables Numéricas Detectadas ({selectedVariables.length} seleccionadas)
          </h2>
          <span className="text-xs text-slate-500">
            Identificadores y constantes se excluyen automáticamente por rigor metodológico
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                <th className="px-3 py-2.5 text-center w-12">Usar</th>
                <th className="px-3 py-2.5 text-left font-semibold">Variable</th>
                <th className="px-3 py-2.5 text-left font-semibold">Naturaleza</th>
                <th className="px-3 py-2.5 text-right font-semibold">Únicos</th>
                <th className="px-3 py-2.5 text-right font-semibold">% Faltantes</th>
                <th className="px-3 py-2.5 text-right font-semibold">VIF</th>
                <th className="px-3 py-2.5 text-left font-semibold">Estado y Criterio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {numericCols.map((col) => {
                const isSelected = selectedVariables.includes(col.name);
                const vif = correlationResult.vifByVariable[col.name];
                const isBlocked = col.isIdentifierLike || col.isConstantOrLowVariance;
                const natureLabel = col.isIdentifierLike
                  ? 'Identificador / Código'
                  : col.isContinuousNumeric
                    ? 'Numérica continua'
                    : 'Numérica discreta';

                return (
                  <tr
                    key={col.name}
                    className={`${isSelected ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isBlocked}
                        onChange={() => onToggleVariable(col.name)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600 cursor-pointer disabled:opacity-40"
                      />
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-900 whitespace-nowrap">
                      {col.name}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                      {natureLabel}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {col.uniqueCount}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono tabular-nums ${
                        col.missingPct > 20 ? 'text-amber-700 font-semibold' : 'text-slate-700'
                      }`}
                    >
                      {col.missingPct.toFixed(1)}%
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono tabular-nums ${
                        vif && vif >= 5 ? 'text-amber-700 font-semibold' : 'text-slate-700'
                      }`}
                    >
                      {isSelected && vif ? vif.toFixed(2) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {col.isIdentifierLike
                        ? 'Excluida automáticamente: identificador secuencial o código sin magnitud.'
                        : col.isConstantOrLowVariance
                          ? 'Excluida automáticamente: varianza nula o casi constante.'
                          : vif && vif >= 5
                            ? `Multicolinealidad elevada (VIF = ${vif.toFixed(2)} >= 5): evalúa retirar una variable redundante.`
                            : col.candidateReason}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Multicollinearity alerts */}
      {correlationResult.highCorrelationPairs.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <span>Pares con alta correlación lineal detectada (|r| ≥ 0.75)</span>
          </div>
          <p className="text-xs text-amber-800">
            Incluir dos variables altamente colineales duplica el peso implícito de esa dimensión en la distancia euclidiana (ej. gasto total vs ticket promedio × frecuencia). Considera deseleccionar la variable redundante o usar su razón unitaria.
          </p>
          <ul className="space-y-1 text-xs font-mono text-amber-950 tabular-nums">
            {correlationResult.highCorrelationPairs.map((pair, idx) => (
              <li key={idx}>
                {pair.varA} ↔ {pair.varB}: r = {pair.r.toFixed(3)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Correlation Matrix Heatmap */}
      {selectedVariables.length >= 2 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Matriz de Correlaciones de Pearson y Mapa de Calor
          </h2>
          <CorrelationHeatmap
            variables={correlationResult.variables}
            matrix={correlationResult.matrix}
          />
        </div>
      )}

      {/* Methodological Note on Categorical / Non-numeric columns */}
      {nonNumericCols.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Info className="h-4 w-4 text-blue-700" />
            <span>
              Implicaciones metodológicas sobre variables no numéricas ({nonNumericCols.length} columnas reservadas para perfilamiento)
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Variables como{' '}
            <span className="font-mono text-slate-800">
              {nonNumericCols.map((c) => c.name).join(', ')}
            </span>{' '}
            no se convierten automáticamente en números. Asignar enteros arbitrarios (Label Encoding) introduce un orden ficticio que distorsiona distancias; aplicar One-Hot Encoding en alta cardinalidad infla la dimensionalidad y diluye las variables continuas en K-Means. Se recomienda mantenerlas fuera del cálculo de distancia euclidiana y utilizarlas posteriormente para perfilamiento descriptivo (o emplear distancia de Gower / K-Prototypes si son indispensables).
          </p>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
   MÓDULO 5. ANÁLISIS DESCRIPTIVO Y REGLAS DE NEGOCIO
============================================================================ */
export const Module5DescriptiveAndRules: React.FC<{
  stats: DescriptiveStats[];
  rules: BusinessRule[];
  context: BusinessContext;
  onUpdateRule: (variable: string, nextMin: number, nextMax: number, userNote: string) => void;
  onNext: () => void;
}> = ({ stats, rules, context, onUpdateRule, onNext }) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="text-xs font-medium text-blue-700">Módulo 05 · Estadística y Reglas de Negocio</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Análisis Descriptivo y Validación de Límites del Sector
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-3xl">
            Métricas de tendencia central, dispersión, percentiles y forma. Contrasta los extremos observados contra límites razonables para {context.sector} sin eliminar observaciones automáticamente.
          </p>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Continuar a Distribuciones y Sesgos
        </button>
      </div>

      {/* Full Descriptive Statistics Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-900">
            Estadísticas Descriptivas Completas
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                <th className="px-3 py-2.5 text-left font-semibold">Variable</th>
                <th className="px-2.5 py-2.5 text-right font-semibold">N</th>
                <th className="px-2.5 py-2.5 text-right font-semibold">Media</th>
                <th className="px-2.5 py-2.5 text-right font-semibold">Mediana</th>
                <th className="px-2.5 py-2.5 text-right font-semibold">Desv. Est.</th>
                <th className="px-2.5 py-2.5 text-right font-semibold">Mín</th>
                <th className="px-2.5 py-2.5 text-right font-semibold">P5</th>
                <th className="px-2.5 py-2.5 text-right font-semibold">Q1</th>
                <th className="px-2.5 py-2.5 text-right font-semibold">Q3</th>
                <th className="px-2.5 py-2.5 text-right font-semibold">P95</th>
                <th className="px-2.5 py-2.5 text-right font-semibold">Máx</th>
                <th className="px-2.5 py-2.5 text-right font-semibold">CV %</th>
                <th className="px-2.5 py-2.5 text-right font-semibold">Asimetría</th>
                <th className="px-2.5 py-2.5 text-right font-semibold">Curtosis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.map((s) => (
                <tr key={s.variable} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium text-slate-900 whitespace-nowrap">
                    {s.variable}
                  </td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums text-slate-700">{s.n}</td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums text-slate-900">{fmt(s.mean)}</td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums text-slate-700">{fmt(s.median)}</td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums text-slate-700">{fmt(s.std)}</td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums text-slate-600">{fmt(s.min)}</td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums text-slate-600">{fmt(s.p5)}</td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums text-slate-600">{fmt(s.q1)}</td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums text-slate-600">{fmt(s.q3)}</td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums text-slate-600">{fmt(s.p95)}</td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums text-slate-600">{fmt(s.max)}</td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums text-slate-700">{s.cvPct.toFixed(1)}%</td>
                  <td
                    className={`px-2.5 py-2.5 text-right font-mono tabular-nums ${
                      Math.abs(s.skewness) >= 1 ? 'text-amber-700 font-semibold' : 'text-slate-700'
                    }`}
                  >
                    {s.skewness.toFixed(2)}
                  </td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {s.kurtosis.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mean vs Median visual bar comparison */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Dispersión Relativa (Coeficiente de Variación) por Variable
        </h2>
        <div className="space-y-2.5">
          {stats.map((s) => {
            const widthPct = Math.min(100, Math.max(4, (s.cvPct / Math.max(100, ...stats.map((x) => x.cvPct))) * 100));
            return (
              <div key={s.variable} className="flex items-center gap-3 text-xs">
                <div className="w-44 truncate font-medium text-slate-800">{s.variable}</div>
                <div className="flex-1 h-3.5 bg-slate-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-blue-700 rounded"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <div className="w-24 text-right font-mono tabular-nums text-slate-700">
                  CV {s.cvPct.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* REGLAS DE NEGOCIO */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              REGLAS DE NEGOCIO — Auditoría de Valores Extremos y Límites Editables
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Diferencia entre errores de captura imposibles y valores extremos reales del negocio (ej. clientes VIP o cuentas ancla). Ninguna fila se elimina automáticamente: tú decides los límites y el tratamiento posterior.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {rules.map((rule) => {
            const hasOutOfBounds = rule.belowMinCount > 0 || rule.aboveMaxCount > 0;
            return (
              <div
                key={rule.variable}
                className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-semibold text-slate-900">{rule.variable}</span>
                    <span className="ml-2 text-xs font-mono text-slate-500 tabular-nums">
                      Observado: [{fmt(rule.observedMin)} , {fmt(rule.observedMax)}]
                    </span>
                  </div>
                  <div className="text-xs font-medium">
                    {rule.impossibleCount > 0 ? (
                      <span className="text-red-700">
                        {rule.impossibleCount} posible(s) error(es) de captura ·{' '}
                      </span>
                    ) : null}
                    {rule.extremeRealCount > 0 ? (
                      <span className="text-amber-700">
                        {rule.extremeRealCount} extremo(s) real(es) &gt; Q3+3·IQR
                      </span>
                    ) : !hasOutOfBounds ? (
                      <span className="text-emerald-700">Dentro de rango esperado</span>
                    ) : (
                      <span className="text-amber-700">
                        {rule.belowMinCount + rule.aboveMaxCount} registro(s) fuera de límite personalizado
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-600">{rule.ruleRationale}</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Límite mínimo permitido
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={rule.customMin}
                      onChange={(e) =>
                        onUpdateRule(
                          rule.variable,
                          Number(e.target.value),
                          rule.customMax,
                          rule.userNote
                        )
                      }
                      className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Límite máximo esperado
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={rule.customMax}
                      onChange={(e) =>
                        onUpdateRule(
                          rule.variable,
                          rule.customMin,
                          Number(e.target.value),
                          rule.userNote
                        )
                      }
                      className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Nota o criterio de validación del analista
                    </label>
                    <input
                      type="text"
                      value={rule.userNote}
                      onChange={(e) =>
                        onUpdateRule(
                          rule.variable,
                          rule.customMin,
                          rule.customMax,
                          e.target.value
                        )
                      }
                      placeholder="Ej. Mantener VIP; revisar si > p99"
                      className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   MÓDULO 6. ANÁLISIS DE DISTRIBUCIONES Y SESGOS
============================================================================ */
export const Module6Distributions: React.FC<{
  dataset: ParsedDataset;
  stats: DescriptiveStats[];
  distributions: DistributionAnalysis[];
  onNext: () => void;
}> = ({ dataset, stats, distributions, onNext }) => {
  const vars = distributions.map((d) => d.variable);
  const [xVar, setXVar] = useState<string>(vars[0] ?? '');
  const [yVar, setYVar] = useState<string>(vars[1] ?? vars[0] ?? '');

  const statsMap = useMemo(() => {
    const m = new Map<string, DescriptiveStats>();
    stats.forEach((s) => m.set(s.variable, s));
    return m;
  }, [stats]);

  const scatterPts = useMemo(() => {
    if (!xVar || !yVar) return [];
    const pts: { x: number; y: number; clusterId: number; label: string }[] = [];
    dataset.rows.forEach((row, idx) => {
      const x = parseNumericValue(row[xVar]);
      const y = parseNumericValue(row[yVar]);
      if (x !== null && y !== null) {
        pts.push({ x, y, clusterId: 0, label: `Fila ${idx + 1}` });
      }
    });
    return pts;
  }, [dataset.rows, xVar, yVar]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="text-xs font-medium text-blue-700">Módulo 06 · Forma de los Datos</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Análisis de Distribuciones, Sesgos y Dispersión
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-3xl">
            Histogramas, curvas de densidad (KDE), diagramas de caja y diagnóstico de asimetría para anticipar el impacto en los centroides y distancias del clustering.
          </p>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Continuar a Transformación de Datos
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {distributions.map((dist) => {
          const st = statsMap.get(dist.variable);
          return (
            <div
              key={dist.variable}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-900">{dist.variable}</h3>
                <div className="text-xs font-mono text-slate-600 tabular-nums">
                  {dist.classification} · Asim: {dist.skewness.toFixed(2)} · Atípicos IQR: {dist.outlierCount}
                </div>
              </div>

              <HistogramWithKdeChart
                analysis={dist}
                mean={st?.mean}
                median={st?.median}
              />

              <div className="pt-2 border-t border-slate-100">
                <div className="text-[11px] font-medium text-slate-500 mb-1">
                  Diagrama de Caja (Boxplot)
                </div>
                <BoxplotChart analysis={dist} />
              </div>

              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">Implicación para clustering: </span>
                {dist.clusteringImplication}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bivariate Scatter Exploration */}
      {vars.length >= 2 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Diagrama de Dispersión Bivariado (Exploración de Relaciones)
              </h2>
              <p className="text-xs text-slate-500">
                Inspecciona agrupaciones naturales, no linealidades o puntos aislados entre pares de variables.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5">
                <span className="text-slate-600">Eje X:</span>
                <select
                  value={xVar}
                  onChange={(e) => setXVar(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                >
                  {vars.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5">
                <span className="text-slate-600">Eje Y:</span>
                <select
                  value={yVar}
                  onChange={(e) => setYVar(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                >
                  {vars.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <ScatterPlot2D points={scatterPts} xLabel={xVar} yLabel={yVar} height={310} />
        </div>
      )}
    </div>
  );
};

/* ============================================================================
   MÓDULO 7. TRANSFORMACIÓN Y PREPARACIÓN DE DATOS
============================================================================ */
export const Module7Transformations: React.FC<{
  configs: VariablePrepConfig[];
  prepared: PreparedDataResult;
  onUpdateConfig: (variable: string, patch: Partial<VariablePrepConfig>) => void;
  onApplyRecommendedSkewFix: () => void;
  onNext: () => void;
}> = ({ configs, prepared, onUpdateConfig, onApplyRecommendedSkewFix, onNext }) => {
  const beforeMap = new Map(prepared.beforeStats.map((s) => [s.variable, s]));
  const afterMap = new Map(prepared.afterTransformStats.map((s) => [s.variable, s]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="text-xs font-medium text-blue-700">Módulo 07 · Preparación Explícita</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Tratamiento de Faltantes, Extremos y Transformaciones
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-3xl">
            Ninguna transformación se aplica en silencio. Configura el tratamiento por variable y compara inmediatamente la asimetría, curtosis y dispersión antes y después.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onApplyRecommendedSkewFix}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Sugerir log en sesgos altos (|asim| ≥ 1)
          </button>
          <button
            type="button"
            disabled={prepared.hasRemainingMissing}
            onClick={onNext}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continuar a Estandarización
          </button>
        </div>
      </div>

      {prepared.hasRemainingMissing && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-900">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <div>
            Existen valores faltantes sin tratar. Los algoritmos de clustering basados en distancia no admiten valores nulos. Selecciona una estrategia de imputación o eliminación explícita para continuar.
          </div>
        </div>
      )}

      {/* Configuration Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-900">
            Configuración de Preparación por Variable
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                <th className="px-3 py-2.5 text-left font-semibold">Variable</th>
                <th className="px-3 py-2.5 text-right font-semibold">Faltantes</th>
                <th className="px-3 py-2.5 text-left font-semibold">Tratamiento de Faltantes</th>
                <th className="px-3 py-2.5 text-left font-semibold">Tratamiento de Extremos</th>
                <th className="px-3 py-2.5 text-left font-semibold">Transformación Matemática</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {configs.map((cfg) => {
                const bStat = beforeMap.get(cfg.variable);
                return (
                  <tr key={cfg.variable} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-medium text-slate-900 whitespace-nowrap">
                      {cfg.variable}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {bStat?.missing ?? 0}
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={cfg.missingStrategy}
                        onChange={(e) =>
                          onUpdateConfig(cfg.variable, {
                            missingStrategy: e.target.value as MissingStrategy,
                          })
                        }
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                      >
                        <option value="impute_median">Imputar con Mediana (robusto)</option>
                        <option value="impute_mean">Imputar con Media</option>
                        <option value="impute_zero">Imputar con Cero (0)</option>
                        <option value="drop_rows">Excluir filas con nulo</option>
                        <option value="keep_error">Mantener nulos (bloquear)</option>
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={cfg.outlierStrategy}
                        onChange={(e) =>
                          onUpdateConfig(cfg.variable, {
                            outlierStrategy: e.target.value as OutlierStrategy,
                          })
                        }
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                      >
                        <option value="none">Sin recorte (conservar reales)</option>
                        <option value="winsor_1_99">Winsorización P1–P99</option>
                        <option value="winsor_5_95">Winsorización P5–P95</option>
                        <option value="iqr_cap">Recorte Tukey 1.5×IQR</option>
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={cfg.mathTransform}
                        onChange={(e) =>
                          onUpdateConfig(cfg.variable, {
                            mathTransform: e.target.value as MathTransform,
                          })
                        }
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                      >
                        <option value="none">Ninguna (escala original)</option>
                        <option value="log1p">Logarítmica ln(1 + x)</option>
                        <option value="sqrt">Raíz cuadrada √x</option>
                        <option value="signed_log">Log con signo sign(x)·ln(1+|x|)</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Before vs After Comparison Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-900">
            Comparación Estadística Antes vs Después de Transformar
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                <th className="px-3 py-2.5 text-left font-semibold">Variable</th>
                <th className="px-3 py-2.5 text-right font-semibold">Media Antes</th>
                <th className="px-3 py-2.5 text-right font-semibold">Media Después</th>
                <th className="px-3 py-2.5 text-right font-semibold">Asimetría Antes</th>
                <th className="px-3 py-2.5 text-right font-semibold">Asimetría Después</th>
                <th className="px-3 py-2.5 text-right font-semibold">Curtosis Antes</th>
                <th className="px-3 py-2.5 text-right font-semibold">Curtosis Después</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {prepared.variables.map((v) => {
                const b = beforeMap.get(v);
                const a = afterMap.get(v);
                if (!b || !a) return null;
                const improvedSkew = Math.abs(a.skewness) < Math.abs(b.skewness);
                return (
                  <tr key={v} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-medium text-slate-900">{v}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600">{fmt(b.mean)}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-900">{fmt(a.mean)}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600">{b.skewness.toFixed(2)}</td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono tabular-nums font-semibold ${
                        improvedSkew ? 'text-emerald-700' : 'text-slate-900'
                      }`}
                    >
                      {a.skewness.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600">{b.kurtosis.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-900">{a.kurtosis.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Traceability Log */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">
          Bitácora de Trazabilidad ({prepared.activeRowIndices.length} filas activas · {prepared.droppedRowCount} excluidas)
        </h3>
        {prepared.transformationLog.length === 0 ? (
          <p className="text-xs text-slate-500">Sin modificaciones aplicadas sobre los valores originales.</p>
        ) : (
          <ul className="space-y-1 text-xs text-slate-700 list-disc pl-5">
            {prepared.transformationLog.map((entry, idx) => (
              <li key={idx}>{entry}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
   MÓDULO 8. ESTANDARIZACIÓN Y NORMALIZACIÓN
============================================================================ */
export const Module8Scaling: React.FC<{
  scalingMethod: ScalingMethod;
  prepared: PreparedDataResult;
  onChangeScaling: (method: ScalingMethod) => void;
  onNext: () => void;
}> = ({ scalingMethod, prepared, onChangeScaling, onNext }) => {
  const previewRows = prepared.activeRowIndices.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="text-xs font-medium text-blue-700">Módulo 08 · Homologación de Escalas</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Normalización Min-Max y Estandarización Z-Score
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-3xl">
            Elimina el dominio artificial de variables con magnitudes grandes (ej. ingresos en millones frente a frecuencias de compra) antes de medir distancias multivariadas.
          </p>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Continuar a Número Óptimo de Clusters
        </button>
      </div>

      {/* Method Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <button
          type="button"
          onClick={() => onChangeScaling('minmax')}
          className={`text-left rounded-xl border p-5 transition-colors cursor-pointer ${
            scalingMethod === 'minmax'
              ? 'border-blue-700 bg-blue-50/40'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-slate-900">
              Normalización Min-Max [0, 1]
            </span>
            {scalingMethod === 'minmax' && (
              <CheckCircle2 className="h-5 w-5 text-blue-700 shrink-0" />
            )}
          </div>
          <div className="mt-2 font-mono text-xs bg-slate-100 text-slate-800 px-3 py-2 rounded border border-slate-200">
            X_normalizado = (X - X_min) / (X_max - X_min)
          </div>
          <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
            Acota todas las variables exactamente al rango [0, 1]. Ideal cuando las variables tienen límites claros, se han tratado extremos y se desea interpretar la posición relativa entre mínimo y máximo. Sensible si persisten atípicos extremos sin acotar.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChangeScaling('zscore')}
          className={`text-left rounded-xl border p-5 transition-colors cursor-pointer ${
            scalingMethod === 'zscore'
              ? 'border-blue-700 bg-blue-50/40'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-slate-900">
              Estandarización Z-Score (μ = 0, σ = 1)
            </span>
            {scalingMethod === 'zscore' && (
              <CheckCircle2 className="h-5 w-5 text-blue-700 shrink-0" />
            )}
          </div>
          <div className="mt-2 font-mono text-xs bg-slate-100 text-slate-800 px-3 py-2 rounded border border-slate-200">
            X_estandarizado = (X - μ) / σ
          </div>
          <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
            Centra cada variable en media 0 y desviación estándar 1. Recomendada para K-Means, PCA y GMM cuando existen colas largas o valores extremos reales que comprimirían la escala Min-Max cerca de 0.
          </p>
        </button>
      </div>

      {/* Methodological Train/Test Leakage Warning */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-start gap-3 text-xs text-slate-700">
        <Info className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-900">Regla de prevención de fuga de datos (Data Leakage): </span>
          Los parámetros de ajuste ({scalingMethod === 'minmax' ? 'X_min y X_max' : 'μ y σ'}) se almacenan explícitamente en el artefacto del modelo. Si se implementa un flujo predictivo posterior para asignar nuevos registros, la transformación debe aplicarse usando únicamente los parámetros ajustados sobre el conjunto de entrenamiento, nunca recalculando sobre el conjunto de prueba o producción.
        </div>
      </div>

      {/* Fitted parameters */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-900">
            Parámetros Ajustados para Reproducibilidad Predictiva
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                <th className="px-3 py-2 text-left font-semibold">Variable</th>
                <th className="px-3 py-2 text-right font-semibold">X_min</th>
                <th className="px-3 py-2 text-right font-semibold">X_max</th>
                <th className="px-3 py-2 text-right font-semibold">Media (μ)</th>
                <th className="px-3 py-2 text-right font-semibold">Desv. Est. (σ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {prepared.scalingParams.map((p) => (
                <tr key={p.variable} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-900">{p.variable}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">{fmt(p.min)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">{fmt(p.max)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">{fmt(p.mean)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">{fmt(p.std)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comparative Sample Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-900">
            Tabla Comparativa: Valores Originales vs Escala Transformada (Primeros 8 registros)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                <th className="px-3 py-2 text-left font-mono">Fila</th>
                {prepared.variables.map((v) => (
                  <th key={v} className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                    {v} (Orig → {scalingMethod === 'minmax' ? 'MinMax' : 'Z'})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {previewRows.map((origIdx, i) => (
                <tr key={origIdx} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-slate-500 tabular-nums">#{origIdx + 1}</td>
                  {prepared.variables.map((v, cIdx) => (
                    <td key={v} className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                      <span className="text-slate-500">{fmt(prepared.originalMatrix[i][cIdx])}</span>
                      <span className="mx-1.5 text-slate-300">→</span>
                      <span className="font-semibold text-blue-800">
                        {prepared.scaledMatrix[i][cIdx].toFixed(3)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
