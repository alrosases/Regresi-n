import { parseNumericValue } from './dataDiagnostics';
import type { ParsedDataset } from '../types/segmentation';

export interface CorrelationMatrixResult {
  variables: string[];
  matrix: number[][]; // p x p Pearson r
  highCorrelationPairs: {
    varA: string;
    varB: string;
    r: number;
  }[];
  vifByVariable: Record<string, number>;
}

export function computePearsonCorrelation(xs: number[], ys: number[]): number {
  const pairs: [number, number][] = [];
  for (let i = 0; i < xs.length; i++) {
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) {
      pairs.push([xs[i], ys[i]]);
    }
  }
  if (pairs.length < 3) return 0;

  let sumX = 0;
  let sumY = 0;
  for (const [x, y] of pairs) {
    sumX += x;
    sumY += y;
  }
  const meanX = sumX / pairs.length;
  const meanY = sumY / pairs.length;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (const [x, y] of pairs) {
    const dx = x - meanX;
    const dy = y - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const denom = Math.sqrt(denX * denY);
  if (denom < 1e-12) return 0;
  return Math.max(-1, Math.min(1, num / denom));
}

function invertMatrix(mat: number[][]): number[][] | null {
  const n = mat.length;
  if (n === 0) return null;
  const aug = mat.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(aug[r][i]) > Math.abs(aug[maxRow][i])) {
        maxRow = r;
      }
    }
    if (Math.abs(aug[maxRow][i]) < 1e-9) {
      // Singular or near-singular matrix -> regularize slightly on diagonal
      aug[maxRow][i] += 1e-4;
    }
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];

    const pivot = aug[i][i];
    for (let j = 0; j < 2 * n; j++) {
      aug[i][j] /= pivot;
    }
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const factor = aug[r][i];
      for (let j = 0; j < 2 * n; j++) {
        aug[r][j] -= factor * aug[i][j];
      }
    }
  }

  return aug.map((row) => row.slice(n));
}

export function computeCorrelationAndVif(
  dataset: ParsedDataset,
  variables: string[]
): CorrelationMatrixResult {
  const p = variables.length;
  if (p === 0) {
    return {
      variables: [],
      matrix: [],
      highCorrelationPairs: [],
      vifByVariable: {},
    };
  }

  const series: number[][] = variables.map((v) =>
    dataset.rows.map((r) => {
      const parsed = parseNumericValue(r[v]);
      return parsed === null ? Number.NaN : parsed;
    })
  );

  const matrix: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  const highCorrelationPairs: CorrelationMatrixResult['highCorrelationPairs'] = [];

  for (let i = 0; i < p; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < p; j++) {
      const r = computePearsonCorrelation(series[i], series[j]);
      matrix[i][j] = r;
      matrix[j][i] = r;
      if (Math.abs(r) >= 0.75) {
        highCorrelationPairs.push({
          varA: variables[i],
          varB: variables[j],
          r,
        });
      }
    }
  }

  const vifByVariable: Record<string, number> = {};
  if (p === 1) {
    vifByVariable[variables[0]] = 1;
  } else {
    const regularized = matrix.map((row, i) =>
      row.map((val, j) => (i === j ? val + 1e-5 : val))
    );
    const inv = invertMatrix(regularized);
    variables.forEach((v, idx) => {
      const rawVif = inv ? Math.abs(inv[idx][idx]) : 1;
      vifByVariable[v] = Math.min(99.9, Math.max(1, Number(rawVif.toFixed(2))));
    });
  }

  highCorrelationPairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

  return {
    variables,
    matrix,
    highCorrelationPairs,
    vifByVariable,
  };
}
