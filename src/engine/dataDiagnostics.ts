import type {
  ColumnDiagnostic,
  DatasetDiagnostics,
  InferredColumnType,
  ParsedDataset,
} from '../types/segmentation';

const MISSING_TOKENS = new Set([
  '',
  'na',
  'n/a',
  'null',
  'none',
  'nan',
  'nil',
  'undefined',
  '-',
  '--',
  'sin dato',
]);

const BOOLEAN_TOKENS = new Set([
  'true',
  'false',
  'sí',
  'si',
  'no',
  'yes',
  '0',
  '1',
  'v',
  'f',
]);

const ID_NAME_REGEX =
  /(^|_|\b)(id|codigo|código|cod|folio|dni|rut|rfc|nit|clave|key|uuid|guid|nro|numero|número|zip|postal|telefono|teléfono|phone|sku|ticket_id|order_id|customer_id|client_id|account_id)($|_|\b)/i;

export function isMissingValue(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'number') return !Number.isFinite(val);
  const str = String(val).trim().toLowerCase();
  return MISSING_TOKENS.has(str);
}

export function parseNumericValue(val: unknown): number | null {
  if (isMissingValue(val)) return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  let s = String(val).trim();
  if (!s) return null;

  // Strip currency symbols, % and spaces
  s = s.replace(/[$€£¥%\s]/g, '');

  // Handle European/Latin number formatting like 1.234,56 vs 1,234.56
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 3 && !/^\d{3}$/.test(parts[1])) {
      s = s.replace(',', '.');
    } else if (parts.length === 2 && parts[1].length !== 3) {
      s = s.replace(',', '.');
    } else {
      // Ambiguous comma like 1,250 -> treat as decimal if <=2 digits after comma else thousand
      if (parts.length === 2 && parts[1].length <= 2) {
        s = s.replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    }
  }

  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) {
    return null;
  }
  const num = Number(s);
  return Number.isFinite(num) ? num : null;
}

function isLikelyDate(str: string): boolean {
  const s = str.trim();
  if (s.length < 6 || s.length > 32) return false;
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}([ T]\d{1,2}:\d{2}(:\d{2})?)?/.test(s)) {
    return !Number.isNaN(Date.parse(s));
  }
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(s)) {
    return true;
  }
  return false;
}

export function diagnoseDataset(dataset: ParsedDataset): DatasetDiagnostics {
  const rowCount = dataset.rows.length;
  const columnCount = dataset.columns.length;

  // Detect exact duplicate rows
  const seenRows = new Set<string>();
  const duplicateRowIndices: number[] = [];
  dataset.rows.forEach((row, idx) => {
    const signature = dataset.columns.map((c) => String(row[c] ?? '').trim()).join('\u0001');
    if (seenRows.has(signature)) {
      duplicateRowIndices.push(idx);
    } else {
      seenRows.add(signature);
    }
  });

  let totalMissingCells = 0;

  const columnDiagnostics: ColumnDiagnostic[] = dataset.columns.map((colName) => {
    const rawValues = dataset.rows.map((r) => r[colName]);
    const nonMissingValues = rawValues.filter((v) => !isMissingValue(v));
    const missingCount = rowCount - nonMissingValues.length;
    totalMissingCells += missingCount;
    const missingPct = rowCount > 0 ? (missingCount / rowCount) * 100 : 0;

    const valueCounts = new Map<string, number>();
    nonMissingValues.forEach((v) => {
      const key = String(v).trim();
      valueCounts.set(key, (valueCounts.get(key) ?? 0) + 1);
    });
    const uniqueCount = valueCounts.size;
    let maxFreq = 0;
    valueCounts.forEach((cnt) => {
      if (cnt > maxFreq) maxFreq = cnt;
    });
    const topValueSharePct =
      nonMissingValues.length > 0 ? (maxFreq / nonMissingValues.length) * 100 : 100;

    // Type detection
    const numericParsed = nonMissingValues.map(parseNumericValue);
    const validNumbers = numericParsed.filter((n): n is number => n !== null);
    const numericRatio =
      nonMissingValues.length > 0 ? validNumbers.length / nonMissingValues.length : 0;

    const boolHits = nonMissingValues.filter((v) =>
      BOOLEAN_TOKENS.has(String(v).trim().toLowerCase())
    ).length;
    const boolRatio = nonMissingValues.length > 0 ? boolHits / nonMissingValues.length : 0;

    const dateHits = nonMissingValues.filter((v) => isLikelyDate(String(v))).length;
    const dateRatio = nonMissingValues.length > 0 ? dateHits / nonMissingValues.length : 0;

    let inferredType: InferredColumnType = 'Texto';
    let isAllInteger = false;

    if (nonMissingValues.length === 0) {
      inferredType = 'Texto';
    } else if (boolRatio >= 0.95 && uniqueCount <= 2) {
      // Check if purely 0/1 numeric or boolean text
      const allTextBool = nonMissingValues.every((v) => {
        const t = String(v).trim().toLowerCase();
        return ['true', 'false', 'sí', 'si', 'no', 'yes', 'v', 'f'].includes(t);
      });
      if (allTextBool || uniqueCount <= 2) {
        inferredType = 'Booleano';
      }
    }

    if (inferredType === 'Texto' && numericRatio >= 0.92) {
      isAllInteger = validNumbers.every((n) => Math.abs(n - Math.round(n)) < 1e-9);
      inferredType = isAllInteger ? 'Numérico entero' : 'Numérico decimal';
    } else if (inferredType === 'Texto' && dateRatio >= 0.85) {
      inferredType = 'Fecha';
    } else if (inferredType === 'Texto') {
      const avgLength =
        nonMissingValues.reduce<number>((acc, v) => acc + String(v).trim().length, 0) /
        Math.max(1, nonMissingValues.length);
      const uniqueRatio = uniqueCount / Math.max(1, nonMissingValues.length);
      if (uniqueCount <= 25 && (uniqueRatio <= 0.35 || avgLength <= 28)) {
        inferredType = 'Categórico';
      } else {
        inferredType = 'Texto';
      }
    }

    // Constant or very low variability
    const isConstantOrLowVariance =
      uniqueCount <= 1 || (nonMissingValues.length >= 10 && topValueSharePct >= 96);

    // Identifier detection
    const nameSuggestsId = ID_NAME_REGEX.test(colName);
    const uniqueRatio =
      nonMissingValues.length > 0 ? uniqueCount / nonMissingValues.length : 0;
    const isMonotonicSequential = (() => {
      if (validNumbers.length < 10 || !isAllInteger) return false;
      let diffsEqualOne = 0;
      for (let i = 1; i < Math.min(validNumbers.length, 40); i++) {
        if (validNumbers[i] - validNumbers[i - 1] === 1) diffsEqualOne++;
      }
      return diffsEqualOne >= Math.min(validNumbers.length, 40) * 0.85;
    })();

    const isIdentifierLike =
      nameSuggestsId ||
      isMonotonicSequential ||
      ((inferredType === 'Numérico entero' || inferredType === 'Texto') &&
        nonMissingValues.length >= 20 &&
        uniqueRatio >= 0.98 &&
        isAllInteger &&
        nameSuggestsId);

    const isDiscreteNumeric =
      inferredType === 'Numérico entero' &&
      !isIdentifierLike &&
      uniqueCount <= 12 &&
      validNumbers.length > 0;

    const isContinuousNumeric =
      (inferredType === 'Numérico decimal' ||
        (inferredType === 'Numérico entero' && !isDiscreteNumeric)) &&
      !isIdentifierLike &&
      numericRatio >= 0.92;

    // Candidate decision for clustering
    let isCandidate = true;
    let candidateReason = 'Variable numérica cuantitativa apta para distancias métricas.';

    if (isConstantOrLowVariance) {
      isCandidate = false;
      candidateReason =
        uniqueCount <= 1
          ? 'Variable constante (varianza cero): no aporta discriminación.'
          : `Variabilidad extremadamente baja (${topValueSharePct.toFixed(1)}% concentrado en un solo valor).`;
    } else if (missingPct > 40) {
      isCandidate = false;
      candidateReason = `Exceso de valores faltantes (${missingPct.toFixed(1)}% > 40%): alto riesgo de sesgo por imputación.`;
    } else if (isIdentifierLike) {
      isCandidate = false;
      candidateReason = 'Identificador o código sin significado cuantitativo (excluir para no contaminar distancias).';
    } else if (inferredType === 'Fecha') {
      isCandidate = false;
      candidateReason = 'Variable temporal: requiere derivar antigüedad o recencia antes de modelar.';
    } else if (inferredType === 'Texto') {
      isCandidate = false;
      candidateReason = 'Texto libre de alta cardinalidad: no utilizable directamente en clustering euclidiano.';
    } else if (inferredType === 'Categórico') {
      isCandidate = false;
      candidateReason = 'Variable categórica: no es numérica continua (usar para perfilamiento posterior o evaluar codificación explícita).';
    } else if (inferredType === 'Booleano') {
      isCandidate = false;
      candidateReason = 'Variable binaria/booleana: útil para perfilamiento; incluir en K-Means solo con justificación de escala.';
    } else if (isDiscreteNumeric) {
      isCandidate = true;
      candidateReason = 'Numérica discreta de baja cardinalidad: candidata secundaria si representa magnitud ordinal/conteo.';
    }

    const sampleValues = nonMissingValues.slice(0, 4).map((v) => String(v));

    return {
      name: colName,
      inferredType,
      totalCount: rowCount,
      uniqueCount,
      missingCount,
      missingPct,
      isConstantOrLowVariance,
      topValueSharePct,
      isIdentifierLike,
      isDiscreteNumeric,
      isContinuousNumeric,
      isCandidate,
      candidateReason,
      sampleValues,
    };
  });

  const totalCells = rowCount * columnCount;
  const totalMissingPct = totalCells > 0 ? (totalMissingCells / totalCells) * 100 : 0;

  const qualityAlerts: DatasetDiagnostics['qualityAlerts'] = [];

  if (rowCount < 20) {
    qualityAlerts.push({
      severity: 'blocking',
      title: 'Tamaño muestral insuficiente',
      detail: `El dataset tiene solo ${rowCount} registros. Se recomiendan al menos 20 observaciones para estimar segmentos estables.`,
    });
  }

  const candidateCount = columnDiagnostics.filter((c) => c.isCandidate).length;
  if (candidateCount < 2) {
    qualityAlerts.push({
      severity: 'blocking',
      title: 'Insuficientes variables numéricas candidatas',
      detail:
        'Se requieren al menos 2 variables numéricas válidas para clustering multivariado. Revisa los tipos de dato o selecciona variables manualmente en el Módulo 4.',
    });
  }

  if (duplicateRowIndices.length > 0) {
    qualityAlerts.push({
      severity: 'warning',
      title: `${duplicateRowIndices.length} registro(s) duplicado(s) detectado(s)`,
      detail:
        'Los registros idénticos duplicados sobrerrepresentan artificialmente ciertos puntos y sesgan los centroides.',
    });
  }

  const highMissingCols = columnDiagnostics.filter((c) => c.missingPct > 20);
  if (highMissingCols.length > 0) {
    qualityAlerts.push({
      severity: 'warning',
      title: `${highMissingCols.length} variable(s) con >20% de datos faltantes`,
      detail: `Columnas afectadas: ${highMissingCols.map((c) => c.name).join(', ')}.`,
    });
  }

  const constantCols = columnDiagnostics.filter((c) => c.isConstantOrLowVariance);
  if (constantCols.length > 0) {
    qualityAlerts.push({
      severity: 'info',
      title: `${constantCols.length} variable(s) constante(s) o de variabilidad mínima`,
      detail: `Se excluyen automáticamente como candidatas: ${constantCols.map((c) => c.name).join(', ')}.`,
    });
  }

  return {
    rowCount,
    columnCount,
    duplicateRowCount: duplicateRowIndices.length,
    duplicateRowIndices,
    totalMissingCells,
    totalMissingPct,
    columnDiagnostics,
    qualityAlerts,
  };
}
