import { parseNumericValue } from './dataDiagnostics';
import { computeDescriptiveStatsForArray, quantile } from './descriptiveAndRules';
import type {
  ParsedDataset,
  PreparedDataResult,
  ScalingFitParams,
  ScalingMethod,
  VariablePrepConfig,
} from '../types/segmentation';

export function buildDefaultPrepConfigs(variables: string[]): VariablePrepConfig[] {
  return variables.map((variable) => ({
    variable,
    missingStrategy: 'impute_median',
    outlierStrategy: 'none',
    mathTransform: 'none',
  }));
}

export function prepareDataPipeline(
  dataset: ParsedDataset,
  configs: VariablePrepConfig[],
  scalingMethod: ScalingMethod
): PreparedDataResult {
  const variables = configs.map((c) => c.variable);
  const log: string[] = [];

  if (variables.length === 0) {
    return {
      variables: [],
      activeRowIndices: [],
      droppedRowCount: 0,
      originalMatrix: [],
      transformedMatrix: [],
      scaledMatrix: [],
      scalingMethod,
      scalingParams: [],
      beforeStats: [],
      afterTransformStats: [],
      transformationLog: [],
      hasRemainingMissing: false,
    };
  }

  // Step 1: Parse raw numeric matrix
  const rawColumns: (number | null)[][] = variables.map((v) =>
    dataset.rows.map((r) => parseNumericValue(r[v]))
  );

  // Determine which rows are dropped by 'drop_rows' missing strategy
  const dropCols = configs
    .map((c, idx) => (c.missingStrategy === 'drop_rows' ? idx : -1))
    .filter((idx) => idx >= 0);

  const activeRowIndices: number[] = [];
  for (let r = 0; r < dataset.rows.length; r++) {
    const shouldDrop = dropCols.some((cIdx) => rawColumns[cIdx][r] === null);
    if (!shouldDrop) {
      activeRowIndices.push(r);
    }
  }
  const droppedRowCount = dataset.rows.length - activeRowIndices.length;
  if (droppedRowCount > 0) {
    log.push(
      `Se excluyeron ${droppedRowCount} fila(s) por presentar valores faltantes en variables configuradas con eliminación por lista.`
    );
  }

  // Step 2: Before stats (on valid values of active rows)
  const beforeStats = variables.map((v, cIdx) => {
    const vals: number[] = [];
    let missing = 0;
    activeRowIndices.forEach((rIdx) => {
      const val = rawColumns[cIdx][rIdx];
      if (val === null) missing++;
      else vals.push(val);
    });
    return computeDescriptiveStatsForArray(v, vals, missing);
  });

  // Step 3: Missing imputation + Outlier treatment + Math transform per column
  let hasRemainingMissing = false;
  const originalColsFilled: number[][] = [];
  const transformedCols: number[][] = [];

  configs.forEach((cfg, cIdx) => {
    const validVals: number[] = [];
    activeRowIndices.forEach((rIdx) => {
      const val = rawColumns[cIdx][rIdx];
      if (val !== null) validVals.push(val);
    });
    const sortedValid = [...validVals].sort((a, b) => a - b);
    const medianVal = quantile(sortedValid, 0.5);
    const meanVal =
      validVals.length > 0
        ? validVals.reduce((a, b) => a + b, 0) / validVals.length
        : 0;

    let missingCountInActive = 0;
    const colImputed: number[] = activeRowIndices.map((rIdx) => {
      const val = rawColumns[cIdx][rIdx];
      if (val !== null) return val;
      missingCountInActive++;
      if (cfg.missingStrategy === 'impute_median') return medianVal;
      if (cfg.missingStrategy === 'impute_mean') return meanVal;
      if (cfg.missingStrategy === 'impute_zero') return 0;
      hasRemainingMissing = true;
      return Number.NaN;
    });

    if (missingCountInActive > 0 && cfg.missingStrategy !== 'keep_error') {
      const stratLabel =
        cfg.missingStrategy === 'impute_median'
          ? `mediana (${medianVal.toFixed(2)})`
          : cfg.missingStrategy === 'impute_mean'
            ? `media (${meanVal.toFixed(2)})`
            : 'cero (0)';
      log.push(
        `${cfg.variable}: ${missingCountInActive} valor(es) faltante(s) imputado(s) con ${stratLabel}.`
      );
    }

    originalColsFilled.push([...colImputed]);

    // Outlier capping
    let colOutlierHandled = [...colImputed];
    const finiteVals = colImputed.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    if (finiteVals.length > 4 && cfg.outlierStrategy !== 'none') {
      let lowCap = finiteVals[0];
      let highCap = finiteVals[finiteVals.length - 1];
      let label = '';

      if (cfg.outlierStrategy === 'winsor_1_99') {
        lowCap = quantile(finiteVals, 0.01);
        highCap = quantile(finiteVals, 0.99);
        label = 'Winsorización P1–P99';
      } else if (cfg.outlierStrategy === 'winsor_5_95') {
        lowCap = quantile(finiteVals, 0.05);
        highCap = quantile(finiteVals, 0.95);
        label = 'Winsorización P5–P95';
      } else if (cfg.outlierStrategy === 'iqr_cap') {
        const q1 = quantile(finiteVals, 0.25);
        const q3 = quantile(finiteVals, 0.75);
        const iqr = q3 - q1;
        lowCap = q1 - 1.5 * iqr;
        highCap = q3 + 1.5 * iqr;
        label = 'Recorte IQR (1.5×IQR)';
      }

      let cappedCount = 0;
      colOutlierHandled = colImputed.map((v) => {
        if (!Number.isFinite(v)) return v;
        if (v < lowCap) {
          cappedCount++;
          return lowCap;
        }
        if (v > highCap) {
          cappedCount++;
          return highCap;
        }
        return v;
      });
      if (cappedCount > 0) {
        log.push(
          `${cfg.variable}: ${label} aplicada en ${cappedCount} observación(es) [${lowCap.toFixed(2)}, ${highCap.toFixed(2)}].`
        );
      }
    }

    // Mathematical transformation
    let colTransformed = [...colOutlierHandled];
    if (cfg.mathTransform !== 'none') {
      const minFinite = Math.min(...colOutlierHandled.filter((v) => Number.isFinite(v)), 0);
      const shift = minFinite < 0 ? Math.abs(minFinite) : 0;

      if (cfg.mathTransform === 'log1p') {
        colTransformed = colOutlierHandled.map((v) =>
          Number.isFinite(v) ? Math.log(1 + Math.max(0, v + shift)) : v
        );
        log.push(
          `${cfg.variable}: transformación logarítmica ln(1 + x${shift > 0 ? ` + ${shift.toFixed(2)}` : ''}).`
        );
      } else if (cfg.mathTransform === 'sqrt') {
        colTransformed = colOutlierHandled.map((v) =>
          Number.isFinite(v) ? Math.sqrt(Math.max(0, v + shift)) : v
        );
        log.push(
          `${cfg.variable}: transformación raíz cuadrada √(x${shift > 0 ? ` + ${shift.toFixed(2)}` : ''}).`
        );
      } else if (cfg.mathTransform === 'signed_log') {
        colTransformed = colOutlierHandled.map((v) =>
          Number.isFinite(v) ? Math.sign(v) * Math.log(1 + Math.abs(v)) : v
        );
        log.push(`${cfg.variable}: transformación logarítmica con signo sign(x)·ln(1 + |x|).`);
      }
    }

    transformedCols.push(colTransformed);
  });

  // Transpose to row-major matrices
  const nActive = activeRowIndices.length;
  const p = variables.length;

  const originalMatrix: number[][] = Array.from({ length: nActive }, (_, r) =>
    Array.from({ length: p }, (_, c) => originalColsFilled[c][r])
  );

  const transformedMatrix: number[][] = Array.from({ length: nActive }, (_, r) =>
    Array.from({ length: p }, (_, c) => transformedCols[c][r])
  );

  const afterTransformStats = variables.map((v, cIdx) => {
    const vals = transformedCols[cIdx].filter((val) => Number.isFinite(val));
    const missing = transformedCols[cIdx].length - vals.length;
    return computeDescriptiveStatsForArray(v, vals, missing);
  });

  // Step 4: Scaling (Min-Max [0, 1] or Z-Score)
  const scalingParams: ScalingFitParams[] = afterTransformStats.map((st) => ({
    variable: st.variable,
    min: st.min,
    max: st.max,
    mean: st.mean,
    std: st.std,
  }));

  const scaledMatrix: number[][] = transformedMatrix.map((row) =>
    row.map((val, cIdx) => {
      if (!Number.isFinite(val)) return Number.NaN;
      const param = scalingParams[cIdx];
      if (scalingMethod === 'minmax') {
        const range = param.max - param.min;
        return range > 1e-12 ? (val - param.min) / range : 0.5;
      } else {
        return param.std > 1e-12 ? (val - param.mean) / param.std : 0;
      }
    })
  );

  log.push(
    scalingMethod === 'minmax'
      ? 'Escalamiento final: Normalización Min-Max al intervalo [0, 1] mediante (X - X_min) / (X_max - X_min).'
      : 'Escalamiento final: Estandarización Z-score (μ = 0, σ = 1) mediante (X - μ) / σ.'
  );

  return {
    variables,
    activeRowIndices,
    droppedRowCount,
    originalMatrix,
    transformedMatrix,
    scaledMatrix,
    scalingMethod,
    scalingParams,
    beforeStats,
    afterTransformStats,
    transformationLog: log,
    hasRemainingMissing,
  };
}
