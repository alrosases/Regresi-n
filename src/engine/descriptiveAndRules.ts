import { parseNumericValue } from './dataDiagnostics';
import type {
  BusinessContext,
  BusinessRule,
  DescriptiveStats,
  DistributionAnalysis,
  ParsedDataset,
} from '../types/segmentation';

export function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function computeDescriptiveStatsForArray(
  variable: string,
  values: number[],
  missingCount: number
): DescriptiveStats {
  const n = values.length;
  if (n === 0) {
    return {
      variable,
      n: 0,
      missing: missingCount,
      mean: 0,
      median: 0,
      std: 0,
      min: 0,
      max: 0,
      q1: 0,
      q3: 0,
      iqr: 0,
      p5: 0,
      p10: 0,
      p90: 0,
      p95: 0,
      cvPct: 0,
      skewness: 0,
      kurtosis: 0,
      iqrOutlierCount: 0,
      severeOutlierCount: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;

  const sqDiffs = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0);
  const variance = n > 1 ? sqDiffs / (n - 1) : 0;
  const std = Math.sqrt(variance);

  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;

  const p5 = quantile(sorted, 0.05);
  const p10 = quantile(sorted, 0.1);
  const p90 = quantile(sorted, 0.9);
  const p95 = quantile(sorted, 0.95);

  const min = sorted[0];
  const max = sorted[n - 1];
  const cvPct = Math.abs(mean) > 1e-9 ? (std / Math.abs(mean)) * 100 : 0;

  let skewness = 0;
  let kurtosis = 0;

  if (std > 1e-12 && n > 2) {
    const m3 = values.reduce((acc, v) => acc + Math.pow((v - mean) / std, 3), 0);
    const m4 = values.reduce((acc, v) => acc + Math.pow((v - mean) / std, 4), 0);
    if (n > 2) {
      skewness = (n / ((n - 1) * (n - 2))) * m3;
    } else {
      skewness = m3 / n;
    }
    if (n > 3) {
      const term1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
      const term2 = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
      kurtosis = term1 * m4 - term2;
    } else {
      kurtosis = m4 / n - 3;
    }
  }

  const lowFence = q1 - 1.5 * iqr;
  const highFence = q3 + 1.5 * iqr;
  const severeLow = q1 - 3.0 * iqr;
  const severeHigh = q3 + 3.0 * iqr;

  const iqrOutlierCount = values.filter((v) => v < lowFence || v > highFence).length;
  const severeOutlierCount = values.filter((v) => v < severeLow || v > severeHigh).length;

  return {
    variable,
    n,
    missing: missingCount,
    mean,
    median,
    std,
    min,
    max,
    q1,
    q3,
    iqr,
    p5,
    p10,
    p90,
    p95,
    cvPct,
    skewness,
    kurtosis,
    iqrOutlierCount,
    severeOutlierCount,
  };
}

export function computeDescriptiveStats(
  dataset: ParsedDataset,
  variables: string[]
): DescriptiveStats[] {
  return variables.map((variable) => {
    const valid: number[] = [];
    let missing = 0;
    dataset.rows.forEach((row) => {
      const val = parseNumericValue(row[variable]);
      if (val === null) {
        missing++;
      } else {
        valid.push(val);
      }
    });
    return computeDescriptiveStatsForArray(variable, valid, missing);
  });
}

export function generateInitialBusinessRules(
  dataset: ParsedDataset,
  statsList: DescriptiveStats[],
  context: BusinessContext
): BusinessRule[] {
  return statsList.map((stat) => {
    const nameLower = stat.variable.toLowerCase();
    const isPct =
      nameLower.includes('pct') ||
      nameLower.includes('porc') ||
      nameLower.includes('tasa') ||
      nameLower.includes('margen') ||
      nameLower.includes('rate') ||
      nameLower.includes('share');
    const isAgeOrTenure =
      nameLower.includes('edad') ||
      nameLower.includes('age') ||
      nameLower.includes('antiguedad') ||
      nameLower.includes('tenure') ||
      nameLower.includes('meses') ||
      nameLower.includes('dias') ||
      nameLower.includes('recencia');
    const isMoneyOrCount =
      nameLower.includes('gasto') ||
      nameLower.includes('ingreso') ||
      nameLower.includes('venta') ||
      nameLower.includes('precio') ||
      nameLower.includes('ticket') ||
      nameLower.includes('facturacion') ||
      nameLower.includes('monto') ||
      nameLower.includes('frecuencia') ||
      nameLower.includes('envios') ||
      nameLower.includes('cantidad') ||
      nameLower.includes('rutas');

    let suggestedMin = stat.min;
    let suggestedMax = stat.max;
    let ruleRationale = `Rango empírico observado para ${context.sector} (${context.observationUnit}).`;

    if (isPct) {
      suggestedMin = nameLower.includes('margen') ? -20 : 0;
      suggestedMax = 100;
      ruleRationale =
        'Variable porcentual o tasa: valores negativos (salvo margen neto con pérdidas) o superiores a 100% suelen indicar errores de escala o captura.';
    } else if (isAgeOrTenure) {
      suggestedMin = 0;
      suggestedMax = nameLower.includes('edad') || nameLower.includes('age')
        ? 110
        : Math.max(stat.max, Math.round(stat.q3 + 3 * stat.iqr));
      ruleRationale =
        'Métrica temporal/antigüedad: no admite valores negativos; valores muy superiores a Q3 + 3·IQR requieren validación contra fecha de inicio.';
    } else if (isMoneyOrCount) {
      suggestedMin = 0;
      suggestedMax = Math.max(stat.p95 * 2.5, stat.q3 + 3 * stat.iqr);
      ruleRationale =
        'Magnitud económica o conteo operativo: valores negativos pueden corresponder a notas crédito o errores; valores sobre Q3 + 3·IQR suelen ser casos VIP/ancla reales.';
    } else {
      suggestedMin = stat.q1 - 3 * stat.iqr;
      suggestedMax = stat.q3 + 3 * stat.iqr;
      ruleRationale =
        'Regla estadística robusta (Q1 − 3·IQR a Q3 + 3·IQR) para distinguir anomalías de captura frente a dispersión legítima.';
    }

    const customMin = Number(suggestedMin.toFixed(2));
    const customMax = Number(suggestedMax.toFixed(2));

    return evaluateBusinessRuleCounts(dataset, stat, {
      variable: stat.variable,
      observedMin: stat.min,
      observedMax: stat.max,
      suggestedMin: customMin,
      suggestedMax: customMax,
      customMin,
      customMax,
      belowMinCount: 0,
      aboveMaxCount: 0,
      impossibleCount: 0,
      extremeRealCount: 0,
      ruleRationale,
      userNote: '',
    });
  });
}

export function evaluateBusinessRuleCounts(
  dataset: ParsedDataset,
  stat: DescriptiveStats,
  rule: BusinessRule
): BusinessRule {
  const nameLower = rule.variable.toLowerCase();
  const isStrictlyNonNegative =
    nameLower.includes('edad') ||
    nameLower.includes('frecuencia') ||
    nameLower.includes('recencia') ||
    nameLower.includes('antiguedad') ||
    nameLower.includes('envios') ||
    nameLower.includes('rutas') ||
    nameLower.includes('ticket');

  let belowMinCount = 0;
  let aboveMaxCount = 0;
  let impossibleCount = 0;
  let extremeRealCount = 0;

  const severeUpper = stat.q3 + 3 * stat.iqr;

  dataset.rows.forEach((row) => {
    const val = parseNumericValue(row[rule.variable]);
    if (val === null) return;
    if (val < rule.customMin) {
      belowMinCount++;
      if (isStrictlyNonNegative && val < 0) {
        impossibleCount++;
      }
    }
    if (val > rule.customMax) {
      aboveMaxCount++;
      if (val > severeUpper) {
        extremeRealCount++;
      }
    }
  });

  return {
    ...rule,
    belowMinCount,
    aboveMaxCount,
    impossibleCount,
    extremeRealCount,
  };
}

export function computeDistributionAnalyses(
  dataset: ParsedDataset,
  statsList: DescriptiveStats[]
): DistributionAnalysis[] {
  return statsList.map((stat) => {
    const values: number[] = [];
    dataset.rows.forEach((row) => {
      const val = parseNumericValue(row[stat.variable]);
      if (val !== null) values.push(val);
    });

    const n = values.length;
    const min = stat.min;
    const max = stat.max;
    const span = max - min;

    const numBins = Math.min(24, Math.max(8, Math.round(1 + 3.322 * Math.log10(Math.max(2, n)))));
    const binWidth = span > 1e-12 ? span / numBins : 1;

    const counts = Array(numBins).fill(0);
    values.forEach((v) => {
      if (span <= 1e-12) {
        counts[0]++;
      } else {
        const idx = Math.min(numBins - 1, Math.max(0, Math.floor((v - min) / binWidth)));
        counts[idx]++;
      }
    });

    const histogramBins = counts.map((count, i) => ({
      x0: min + i * binWidth,
      x1: min + (i + 1) * binWidth,
      count,
      density: n > 0 && binWidth > 0 ? count / (n * binWidth) : 0,
    }));

    // Gaussian KDE curve (Silverman's rule of thumb bandwidth)
    const kdeCurve: { x: number; y: number }[] = [];
    if (n > 1 && stat.std > 1e-9 && span > 1e-9) {
      const iqrScale = stat.iqr > 0 ? stat.iqr / 1.34 : stat.std;
      const bw = Math.max(1e-6, 0.9 * Math.min(stat.std, iqrScale) * Math.pow(n, -0.2));
      const steps = 40;
      const samplePts = n > 400 ? values.filter((_, idx) => idx % Math.ceil(n / 400) === 0) : values;
      for (let s = 0; s <= steps; s++) {
        const x = min + (span * s) / steps;
        let sumK = 0;
        for (const v of samplePts) {
          const u = (x - v) / bw;
          sumK += Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
        }
        kdeCurve.push({ x, y: sumK / (samplePts.length * bw) });
      }
    }

    // Boxplot whiskers & outliers
    const lowFence = stat.q1 - 1.5 * stat.iqr;
    const highFence = stat.q3 + 1.5 * stat.iqr;
    const insideValues = values.filter((v) => v >= lowFence && v <= highFence);
    const minWhisker = insideValues.length > 0 ? Math.min(...insideValues) : stat.min;
    const maxWhisker = insideValues.length > 0 ? Math.max(...insideValues) : stat.max;
    const outliers = values
      .filter((v) => v < lowFence || v > highFence)
      .slice(0, 60);

    let classification: DistributionAnalysis['classification'] = 'Simétrica';
    if (stat.kurtosis > 3.5 && Math.abs(stat.skewness) < 0.75) {
      classification = 'Concentración anormal';
    } else if (stat.skewness >= 0.75) {
      classification = 'Sesgo positivo';
    } else if (stat.skewness <= -0.75) {
      classification = 'Sesgo negativo';
    } else if (stat.kurtosis < -0.9) {
      classification = 'Multimodal / Dispersa';
    }

    let clusteringImplication =
      'Distribución equilibrada: K-Means y GMM operan con centroides representativos tras estandarización estándar.';
    if (classification === 'Sesgo positivo') {
      clusteringImplication =
        'Cola derecha pronunciada: en K-Means las distancias cuadráticas magnifican los valores altos y atraen centroides hacia la cola; evalúa transformación logarítmica o winsorización.';
    } else if (classification === 'Sesgo negativo') {
      clusteringImplication =
        'Cola izquierda extendida: valores inusualmente bajos pueden formar micro-clusters aislados o distorsionar la media; considera winsorización inferior o clustering basado en densidad.';
    } else if (classification === 'Concentración anormal') {
      clusteringImplication =
        'Alta curtosis (pico agudo): gran concentración de registros en un rango estrecho. Normalización Min-Max puede comprimir la mayoría de los datos cerca de un punto; Z-score o transformación ayudan a separar.';
    } else if (classification === 'Multimodal / Dispersa') {
      clusteringImplication =
        'Baja curtosis / posible multimodalidad: excelente señal para clustering, ya que sugiere subpoblaciones naturales diferenciables en esta dimensión.';
    }

    return {
      variable: stat.variable,
      classification,
      skewness: stat.skewness,
      kurtosis: stat.kurtosis,
      outlierCount: stat.iqrOutlierCount,
      histogramBins,
      kdeCurve,
      boxplot: {
        minWhisker,
        q1: stat.q1,
        median: stat.median,
        q3: stat.q3,
        maxWhisker,
        outliers,
      },
      clusteringImplication,
    };
  });
}
