import { quantile } from './descriptiveAndRules';
import type {
  BusinessContext,
  ClusterSummary,
  ClusteringModelResult,
  ClusteringRunParams,
  OptimalKAnalysis,
  OptimalKMetrics,
  PreparedDataResult,
} from '../types/segmentation';

export const SEGMENT_COLORS = [
  '#1d4ed8', // Cobalt Blue
  '#059669', // Emerald
  '#d97706', // Amber
  '#7c3aed', // Violet
  '#0891b2', // Cyan-Teal
  '#db2777', // Rose
  '#4f46e5', // Indigo
  '#ea580c', // Deep Orange
  '#0d9488', // Teal
  '#65a30d', // Olive
];

function createSeededRng(seed: number): () => number {
  let state = (seed || 42) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sqDist(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s;
}

function euclidDist(a: number[], b: number[]): number {
  return Math.sqrt(sqDist(a, b));
}

function computeCentroids(data: number[][], labels: number[], k: number): number[][] {
  const p = data[0]?.length ?? 0;
  const sums = Array.from({ length: k }, () => Array(p).fill(0));
  const counts = Array(k).fill(0);
  for (let i = 0; i < data.length; i++) {
    const c = labels[i];
    if (c >= 0 && c < k) {
      counts[c]++;
      for (let j = 0; j < p; j++) sums[c][j] += data[i][j];
    }
  }
  return sums.map((row, c) =>
    counts[c] > 0 ? row.map((v) => v / counts[c]) : data[c % data.length].slice()
  );
}

export function runKMeansRaw(
  data: number[][],
  k: number,
  seed: number,
  maxIter = 100,
  nInit = 8
): { labels: number[]; centroids: number[][]; inertia: number } {
  const n = data.length;
  const p = data[0]?.length ?? 0;
  if (n === 0 || p === 0 || k <= 1) {
    const centroids = k === 1 && n > 0 ? [computeMeanVector(data)] : [];
    const labels = Array(n).fill(0);
    const inertia =
      centroids.length > 0
        ? data.reduce((acc, row) => acc + sqDist(row, centroids[0]), 0)
        : 0;
    return { labels, centroids, inertia };
  }

  const effectiveK = Math.min(k, n);
  let bestResult: { labels: number[]; centroids: number[][]; inertia: number } | null = null;
  const rand = createSeededRng(seed);

  for (let initRun = 0; initRun < nInit; initRun++) {
    // K-Means++ initialization
    const centroids: number[][] = [];
    const firstIdx = Math.floor(rand() * n);
    centroids.push(data[firstIdx].slice());

    const minSqDists = new Float64Array(n).fill(Infinity);
    for (let c = 1; c < effectiveK; c++) {
      let totalDist = 0;
      const lastCentroid = centroids[centroids.length - 1];
      for (let i = 0; i < n; i++) {
        const d = sqDist(data[i], lastCentroid);
        if (d < minSqDists[i]) minSqDists[i] = d;
        totalDist += minSqDists[i];
      }
      if (totalDist <= 1e-12) {
        centroids.push(data[Math.floor(rand() * n)].slice());
        continue;
      }
      let r = rand() * totalDist;
      let chosen = n - 1;
      for (let i = 0; i < n; i++) {
        r -= minSqDists[i];
        if (r <= 0) {
          chosen = i;
          break;
        }
      }
      centroids.push(data[chosen].slice());
    }

    const labels = Array(n).fill(0);
    for (let iter = 0; iter < maxIter; iter++) {
      let changed = false;
      for (let i = 0; i < n; i++) {
        let bestC = 0;
        let bestD = Infinity;
        for (let c = 0; c < effectiveK; c++) {
          const d = sqDist(data[i], centroids[c]);
          if (d < bestD) {
            bestD = d;
            bestC = c;
          }
        }
        if (labels[i] !== bestC) {
          labels[i] = bestC;
          changed = true;
        }
      }

      const sums = Array.from({ length: effectiveK }, () => Array(p).fill(0));
      const counts = Array(effectiveK).fill(0);
      for (let i = 0; i < n; i++) {
        const c = labels[i];
        counts[c]++;
        for (let j = 0; j < p; j++) sums[c][j] += data[i][j];
      }

      for (let c = 0; c < effectiveK; c++) {
        if (counts[c] > 0) {
          for (let j = 0; j < p; j++) centroids[c][j] = sums[c][j] / counts[c];
        } else {
          // Empty cluster recovery: pick point farthest from its centroid
          let farthestIdx = 0;
          let maxErr = -1;
          for (let i = 0; i < n; i++) {
            const err = sqDist(data[i], centroids[labels[i]]);
            if (err > maxErr) {
              maxErr = err;
              farthestIdx = i;
            }
          }
          centroids[c] = data[farthestIdx].slice();
        }
      }

      if (!changed) break;
    }

    let inertia = 0;
    for (let i = 0; i < n; i++) {
      inertia += sqDist(data[i], centroids[labels[i]]);
    }

    if (!bestResult || inertia < bestResult.inertia) {
      bestResult = { labels, centroids, inertia };
    }
  }

  return bestResult!;
}

function computeMeanVector(data: number[][]): number[] {
  const n = data.length;
  const p = data[0]?.length ?? 0;
  const mean = Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) mean[j] += data[i][j];
  }
  return mean.map((v) => v / Math.max(1, n));
}

export function computeClusterEvaluationMetrics(
  data: number[][],
  rawLabels: number[]
): {
  silhouette: number;
  calinskiHarabasz: number;
  daviesBouldin: number;
  inertia: number;
} {
  // Filter out noise (-1) for cluster quality metrics
  const validIndices: number[] = [];
  const clusterMap = new Map<number, number>();
  let nextId = 0;
  const labels: number[] = [];

  rawLabels.forEach((lbl, idx) => {
    if (lbl >= 0) {
      if (!clusterMap.has(lbl)) clusterMap.set(lbl, nextId++);
      validIndices.push(idx);
      labels.push(clusterMap.get(lbl)!);
    }
  });

  const k = clusterMap.size;
  const n = validIndices.length;
  if (n < 4 || k < 2) {
    return { silhouette: 0, calinskiHarabasz: 0, daviesBouldin: 0, inertia: 0 };
  }

  const validData = validIndices.map((idx) => data[idx]);
  const centroids = computeCentroids(validData, labels, k);
  const globalMean = computeMeanVector(validData);

  const clusterCounts = Array(k).fill(0);
  labels.forEach((c) => clusterCounts[c]++);

  // Inertia (WCSS) & Between-Cluster SS (BCSS)
  let wcss = 0;
  for (let i = 0; i < n; i++) {
    wcss += sqDist(validData[i], centroids[labels[i]]);
  }
  let bcss = 0;
  for (let c = 0; c < k; c++) {
    bcss += clusterCounts[c] * sqDist(centroids[c], globalMean);
  }

  const calinskiHarabasz =
    wcss > 1e-12 && n > k ? (bcss / (k - 1)) / (wcss / (n - k)) : 0;

  // Davies-Bouldin Index
  const scatters = Array(k).fill(0);
  for (let i = 0; i < n; i++) {
    const c = labels[i];
    scatters[c] += euclidDist(validData[i], centroids[c]);
  }
  for (let c = 0; c < k; c++) {
    scatters[c] = clusterCounts[c] > 0 ? scatters[c] / clusterCounts[c] : 0;
  }

  let dbSum = 0;
  for (let i = 0; i < k; i++) {
    let maxRatio = 0;
    for (let j = 0; j < k; j++) {
      if (i === j) continue;
      const distC = euclidDist(centroids[i], centroids[j]);
      if (distC > 1e-12) {
        const ratio = (scatters[i] + scatters[j]) / distC;
        if (ratio > maxRatio) maxRatio = ratio;
      }
    }
    dbSum += maxRatio;
  }
  const daviesBouldin = dbSum / k;

  // Silhouette Score (subsampled uniformly if n > 450 for interactive <100ms computation)
  const stride = n > 450 ? Math.ceil(n / 450) : 1;
  const sampleIdx: number[] = [];
  for (let i = 0; i < n; i += stride) sampleIdx.push(i);

  let silSum = 0;
  for (const idx of sampleIdx) {
    const ownC = labels[idx];
    const clusterSums = Array(k).fill(0);
    const clusterSampleCounts = Array(k).fill(0);

    for (const jdx of sampleIdx) {
      if (idx === jdx) continue;
      const d = euclidDist(validData[idx], validData[jdx]);
      const otherC = labels[jdx];
      clusterSums[otherC] += d;
      clusterSampleCounts[otherC]++;
    }

    if (clusterSampleCounts[ownC] === 0) {
      continue;
    }
    const a = clusterSums[ownC] / clusterSampleCounts[ownC];
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === ownC || clusterSampleCounts[c] === 0) continue;
      const avgD = clusterSums[c] / clusterSampleCounts[c];
      if (avgD < b) b = avgD;
    }
    if (!Number.isFinite(b)) continue;
    const denom = Math.max(a, b);
    if (denom > 1e-12) {
      silSum += (b - a) / denom;
    }
  }
  const silhouette = sampleIdx.length > 0 ? silSum / sampleIdx.length : 0;

  return {
    silhouette: Number(silhouette.toFixed(4)),
    calinskiHarabasz: Number(calinskiHarabasz.toFixed(2)),
    daviesBouldin: Number(daviesBouldin.toFixed(4)),
    inertia: Number(wcss.toFixed(2)),
  };
}

export function analyzeOptimalK(
  prepared: PreparedDataResult,
  seed: number,
  maxK = 8
): OptimalKAnalysis {
  const data = prepared.scaledMatrix;
  const n = data.length;
  const p = data[0]?.length ?? 0;
  const upperK = Math.min(maxK, Math.max(2, Math.floor(n / 4)));

  // Bounding box for Gap Statistic uniform reference
  const mins = Array(p).fill(Infinity);
  const maxs = Array(p).fill(-Infinity);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      if (data[i][j] < mins[j]) mins[j] = data[i][j];
      if (data[i][j] > maxs[j]) maxs[j] = data[i][j];
    }
  }

  const B = 10; // Reference uniform datasets
  const rand = createSeededRng(seed + 101);
  const refSampleSize = Math.min(n, 220);
  const refDatasets: number[][][] = Array.from({ length: B }, () =>
    Array.from({ length: refSampleSize }, () =>
      Array.from({ length: p }, (_, j) => mins[j] + rand() * (maxs[j] - mins[j]))
    )
  );

  // Subsample real data proportionally if n > 220 for Gap comparison consistency
  const strideGap = n > 220 ? Math.ceil(n / 220) : 1;
  const dataForGap = strideGap > 1 ? data.filter((_, idx) => idx % strideGap === 0) : data;

  const metrics: OptimalKMetrics[] = [];

  for (let k = 2; k <= upperK; k++) {
    const km = runKMeansRaw(data, k, seed + k, 80, 5);
    const evalM = computeClusterEvaluationMetrics(data, km.labels);

    const kmGapData =
      strideGap > 1 ? runKMeansRaw(dataForGap, k, seed + k, 60, 3) : km;
    const logW = Math.log(Math.max(1e-9, kmGapData.inertia));

    const refLogs: number[] = [];
    for (let b = 0; b < B; b++) {
      const refKm = runKMeansRaw(refDatasets[b], k, seed + b * 31 + k, 50, 2);
      refLogs.push(Math.log(Math.max(1e-9, refKm.inertia)));
    }
    const meanRefLog = refLogs.reduce((a, b) => a + b, 0) / B;
    const sdRef = Math.sqrt(
      refLogs.reduce((acc, v) => acc + Math.pow(v - meanRefLog, 2), 0) / B
    );
    const gapStatistic = meanRefLog - logW;
    const gapStdError = sdRef * Math.sqrt(1 + 1 / B);

    metrics.push({
      k,
      inertia: evalM.inertia,
      silhouette: evalM.silhouette,
      gapStatistic: Number(gapStatistic.toFixed(4)),
      gapStdError: Number(gapStdError.toFixed(4)),
      calinskiHarabasz: evalM.calinskiHarabasz,
      daviesBouldin: evalM.daviesBouldin,
    });
  }

  // Elbow recommendation via maximum perpendicular distance to line connecting k=2 and k=upperK
  let elbowRecommendedK = metrics[0]?.k ?? 3;
  if (metrics.length >= 3) {
    const first = metrics[0];
    const last = metrics[metrics.length - 1];
    const x1 = first.k;
    const y1 = first.inertia;
    const x2 = last.k;
    const y2 = last.inertia;
    const denom = Math.hypot(y2 - y1, x2 - x1) || 1;

    // Normalize axes to [0,1] for geometric knee stability
    const kSpan = Math.max(1, x2 - x1);
    const iSpan = Math.max(1e-6, y1 - y2);
    let maxKneeDist = -1;
    for (let i = 1; i < metrics.length - 1; i++) {
      const nx = (metrics[i].k - x1) / kSpan;
      const ny = (metrics[i].inertia - y2) / iSpan;
      const dist = Math.abs(nx + ny - 1) / Math.SQRT2;
      if (dist > maxKneeDist && denom > 0) {
        maxKneeDist = dist;
        elbowRecommendedK = metrics[i].k;
      }
    }
  }

  const silhouetteRecommendedK = metrics.reduce(
    (best, cur) => (cur.silhouette > best.silhouette ? cur : best),
    metrics[0]
  ).k;

  // Tibshirani criterion: smallest k such that Gap(k) >= Gap(k+1) - s_{k+1}
  let gapRecommendedK = metrics[metrics.length - 1]?.k ?? 3;
  for (let i = 0; i < metrics.length - 1; i++) {
    if (
      metrics[i].gapStatistic >=
      metrics[i + 1].gapStatistic - metrics[i + 1].gapStdError
    ) {
      gapRecommendedK = metrics[i].k;
      break;
    }
  }

  const calinskiRecommendedK = metrics.reduce(
    (best, cur) => (cur.calinskiHarabasz > best.calinskiHarabasz ? cur : best),
    metrics[0]
  ).k;

  const daviesRecommendedK = metrics.reduce(
    (best, cur) => (cur.daviesBouldin < best.daviesBouldin ? cur : best),
    metrics[0]
  ).k;

  // Weighted consensus favoring Silhouette, Elbow, and Gap in practical range 3..6
  const votes = new Map<number, number>();
  const addVote = (kVal: number, weight: number) => {
    votes.set(kVal, (votes.get(kVal) ?? 0) + weight);
  };
  addVote(silhouetteRecommendedK, 2.0);
  addVote(elbowRecommendedK, 1.8);
  addVote(gapRecommendedK, 1.5);
  addVote(calinskiRecommendedK, 1.0);
  addVote(daviesRecommendedK, 1.0);

  let consensusRecommendedK = silhouetteRecommendedK;
  let bestVoteScore = -1;
  votes.forEach((score, kVal) => {
    if (score > bestVoteScore) {
      bestVoteScore = score;
      consensusRecommendedK = kVal;
    }
  });

  return {
    metrics,
    elbowRecommendedK,
    silhouetteRecommendedK,
    gapRecommendedK,
    calinskiRecommendedK,
    daviesRecommendedK,
    consensusRecommendedK,
  };
}

function runHierarchicalClustering(
  data: number[][],
  k: number,
  linkage: 'ward' | 'complete' | 'average'
): number[] {
  const n = data.length;
  if (n <= k) return data.map((_, i) => i);

  // If n > 320, cluster 320 K-Means++ micro-clusters first (standard scalable Ward hybrid)
  let basePoints = data;
  let preLabels: number[] | null = null;
  if (n > 320) {
    const pre = runKMeansRaw(data, 220, 77, 25, 1);
    basePoints = pre.centroids;
    preLabels = pre.labels;
  }

  const m = basePoints.length;
  const active = Array.from({ length: m }, (_, i) => i);
  const members: number[][] = Array.from({ length: m }, (_, i) => [i]);
  const sizes = Array(m).fill(1);
  const centroids = basePoints.map((pt) => pt.slice());

  // Pairwise dissimilarity matrix
  const distMat: Float64Array[] = Array.from({ length: m }, () => new Float64Array(m));
  for (let i = 0; i < m; i++) {
    for (let j = i + 1; j < m; j++) {
      const d =
        linkage === 'ward'
          ? 0.5 * sqDist(basePoints[i], basePoints[j])
          : euclidDist(basePoints[i], basePoints[j]);
      distMat[i][j] = d;
      distMat[j][i] = d;
    }
  }

  while (active.length > k) {
    let bestI = 0;
    let bestJ = 1;
    let bestD = Infinity;

    for (let ai = 0; ai < active.length; ai++) {
      const i = active[ai];
      for (let aj = ai + 1; aj < active.length; aj++) {
        const j = active[aj];
        const d = distMat[i][j];
        if (d < bestD) {
          bestD = d;
          bestI = ai;
          bestJ = aj;
        }
      }
    }

    const c1 = active[bestI];
    const c2 = active[bestJ];
    const newMembers = [...members[c1], ...members[c2]];
    const newSize = sizes[c1] + sizes[c2];
    const p = centroids[c1].length;
    const newCentroid = Array(p).fill(0);
    for (let d = 0; d < p; d++) {
      newCentroid[d] = (centroids[c1][d] * sizes[c1] + centroids[c2][d] * sizes[c2]) / newSize;
    }

    // Update distances from c1 to all other active clusters
    for (let ak = 0; ak < active.length; ak++) {
      const ck = active[ak];
      if (ck === c1 || ck === c2) continue;
      let newDist = 0;
      if (linkage === 'ward') {
        const nk = sizes[ck];
        newDist =
          ((sizes[c1] + nk) * distMat[c1][ck] +
            (sizes[c2] + nk) * distMat[c2][ck] -
            nk * bestD) /
          (newSize + nk);
      } else if (linkage === 'complete') {
        newDist = Math.max(distMat[c1][ck], distMat[c2][ck]);
      } else {
        newDist =
          (sizes[c1] * distMat[c1][ck] + sizes[c2] * distMat[c2][ck]) / newSize;
      }
      distMat[c1][ck] = newDist;
      distMat[ck][c1] = newDist;
    }

    members[c1] = newMembers;
    sizes[c1] = newSize;
    centroids[c1] = newCentroid;
    active.splice(bestJ, 1);
  }

  const baseLabels = Array(m).fill(0);
  active.forEach((cid, clusterIdx) => {
    members[cid].forEach((ptIdx) => {
      baseLabels[ptIdx] = clusterIdx;
    });
  });

  if (preLabels) {
    return preLabels.map((microId) => baseLabels[microId]);
  }
  return baseLabels;
}

export function suggestDbscanEps(data: number[][], minPts = 5): number {
  const n = data.length;
  if (n < 5) return 0.5;
  const k = Math.min(minPts, n - 1);
  const stride = n > 300 ? Math.ceil(n / 300) : 1;
  const kDists: number[] = [];

  for (let i = 0; i < n; i += stride) {
    const dists: number[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      dists.push(euclidDist(data[i], data[j]));
    }
    dists.sort((a, b) => a - b);
    kDists.push(dists[Math.max(0, k - 1)]);
  }
  kDists.sort((a, b) => a - b);
  return Number(quantile(kDists, 0.72).toFixed(3));
}

function runDbscan(data: number[][], eps: number, minPts: number): number[] {
  const n = data.length;
  const labels = Array(n).fill(-2); // -2 unvisited, -1 noise
  let clusterId = 0;

  const regionQuery = (idx: number): number[] => {
    const neighbors: number[] = [];
    for (let j = 0; j < n; j++) {
      if (euclidDist(data[idx], data[j]) <= eps) neighbors.push(j);
    }
    return neighbors;
  };

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -2) continue;
    const neighbors = regionQuery(i);
    if (neighbors.length < minPts) {
      labels[i] = -1;
      continue;
    }

    labels[i] = clusterId;
    const queue = [...neighbors];
    let qPos = 0;
    while (qPos < queue.length) {
      const pt = queue[qPos++];
      if (labels[pt] === -1) labels[pt] = clusterId;
      if (labels[pt] !== -2) continue;
      labels[pt] = clusterId;
      const ptNeighbors = regionQuery(pt);
      if (ptNeighbors.length >= minPts) {
        for (const nb of ptNeighbors) {
          if (labels[nb] === -2 || labels[nb] === -1) {
            queue.push(nb);
          }
        }
      }
    }
    clusterId++;
  }

  return labels;
}

function runGmmDiagonal(
  data: number[][],
  k: number,
  seed: number,
  maxIter = 60
): { labels: number[]; bic: number } {
  const n = data.length;
  const p = data[0]?.length ?? 0;
  const init = runKMeansRaw(data, k, seed, 40, 4);
  const means = init.centroids.map((c) => c.slice());
  const weights = Array(k).fill(1 / k);
  const vars = Array.from({ length: k }, () => Array(p).fill(0.25));

  // Initial diagonal variances from K-Means clusters
  const counts = Array(k).fill(0);
  const sumsSq = Array.from({ length: k }, () => Array(p).fill(0));
  for (let i = 0; i < n; i++) {
    const c = init.labels[i];
    counts[c]++;
    for (let j = 0; j < p; j++) {
      sumsSq[c][j] += Math.pow(data[i][j] - means[c][j], 2);
    }
  }
  for (let c = 0; c < k; c++) {
    weights[c] = Math.max(0.02, counts[c] / Math.max(1, n));
    for (let j = 0; j < p; j++) {
      vars[c][j] = Math.max(1e-3, sumsSq[c][j] / Math.max(1, counts[c]));
    }
  }

  const resp: number[][] = Array.from({ length: n }, () => Array(k).fill(0));
  let logLikelihood = -Infinity;

  for (let iter = 0; iter < maxIter; iter++) {
    let newLogLik = 0;
    // E-step
    for (let i = 0; i < n; i++) {
      const logProbs = Array(k).fill(0);
      let maxLogP = -Infinity;
      for (let c = 0; c < k; c++) {
        let lp = Math.log(Math.max(1e-8, weights[c]));
        for (let j = 0; j < p; j++) {
          const v = vars[c][j];
          const diff = data[i][j] - means[c][j];
          lp += -0.5 * (Math.log(2 * Math.PI * v) + (diff * diff) / v);
        }
        logProbs[c] = lp;
        if (lp > maxLogP) maxLogP = lp;
      }

      let sumExp = 0;
      for (let c = 0; c < k; c++) {
        sumExp += Math.exp(logProbs[c] - maxLogP);
      }
      const logSum = maxLogP + Math.log(sumExp);
      newLogLik += logSum;
      for (let c = 0; c < k; c++) {
        resp[i][c] = Math.exp(logProbs[c] - logSum);
      }
    }

    // M-step
    for (let c = 0; c < k; c++) {
      let nk = 0;
      for (let i = 0; i < n; i++) nk += resp[i][c];
      nk = Math.max(1e-6, nk);
      weights[c] = nk / n;

      for (let j = 0; j < p; j++) {
        let mu = 0;
        for (let i = 0; i < n; i++) mu += resp[i][c] * data[i][j];
        means[c][j] = mu / nk;
      }

      for (let j = 0; j < p; j++) {
        let v = 0;
        for (let i = 0; i < n; i++) {
          const d = data[i][j] - means[c][j];
          v += resp[i][c] * d * d;
        }
        vars[c][j] = Math.max(1e-3, v / nk);
      }
    }

    if (Math.abs(newLogLik - logLikelihood) < 1e-4) {
      logLikelihood = newLogLik;
      break;
    }
    logLikelihood = newLogLik;
  }

  const labels = resp.map((row) => {
    let bestC = 0;
    for (let c = 1; c < k; c++) {
      if (row[c] > row[bestC]) bestC = c;
    }
    return bestC;
  });

  const numParams = k * (2 * p) + (k - 1);
  const bic = -2 * logLikelihood + numParams * Math.log(Math.max(2, n));
  return { labels, bic: Number(bic.toFixed(1)) };
}

function computePca2D(data: number[][]): {
  projected: [number, number][];
  explainedRatio: [number, number];
} {
  const n = data.length;
  const p = data[0]?.length ?? 0;
  if (n === 0 || p === 0) {
    return { projected: [], explainedRatio: [0, 0] };
  }
  if (p === 1) {
    return {
      projected: data.map((r) => [r[0], 0]),
      explainedRatio: [100, 0],
    };
  }

  // Standardize columns internally for balanced PCA visualization
  const means = Array(p).fill(0);
  const stds = Array(p).fill(0);
  for (let j = 0; j < p; j++) {
    for (let i = 0; i < n; i++) means[j] += data[i][j];
    means[j] /= n;
    for (let i = 0; i < n; i++) stds[j] += Math.pow(data[i][j] - means[j], 2);
    stds[j] = Math.sqrt(stds[j] / Math.max(1, n - 1)) || 1;
  }

  const zData = data.map((r) => r.map((v, j) => (v - means[j]) / stds[j]));

  // Covariance matrix (p x p)
  const cov: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = i; j < p; j++) {
      let s = 0;
      for (let r = 0; r < n; r++) s += zData[r][i] * zData[r][j];
      const val = s / Math.max(1, n - 1);
      cov[i][j] = val;
      cov[j][i] = val;
    }
  }

  const totalVar = cov.reduce((acc, row, idx) => acc + row[idx], 0) || p;

  const powerIteration = (mat: number[][]): { vec: number[]; eigVal: number } => {
    let vec: number[] = Array.from({ length: p }, (_, i) => ((i + 1) % 2 === 0 ? 1 : -0.7));
    let norm = Math.hypot(...vec) || 1;
    vec = vec.map((v) => v / norm);

    for (let iter = 0; iter < 60; iter++) {
      const next = Array(p).fill(0);
      for (let i = 0; i < p; i++) {
        for (let j = 0; j < p; j++) next[i] += mat[i][j] * vec[j];
      }
      norm = Math.hypot(...next) || 1;
      vec = next.map((v) => v / norm);
    }

    const mv = Array(p).fill(0);
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < p; j++) mv[i] += mat[i][j] * vec[j];
    }
    const eigVal = Math.max(0, vec.reduce((acc, v, i) => acc + v * mv[i], 0));
    return { vec, eigVal };
  };

  const pc1Res = powerIteration(cov);
  // Deflate covariance matrix for PC2
  const cov2 = cov.map((row, i) =>
    row.map((val, j) => val - pc1Res.eigVal * pc1Res.vec[i] * pc1Res.vec[j])
  );
  const pc2Res = powerIteration(cov2);

  const projected: [number, number][] = zData.map((r) => [
    r.reduce((acc, v, j) => acc + v * pc1Res.vec[j], 0),
    r.reduce((acc, v, j) => acc + v * pc2Res.vec[j], 0),
  ]);

  return {
    projected,
    explainedRatio: [
      Number(((pc1Res.eigVal / totalVar) * 100).toFixed(1)),
      Number(((pc2Res.eigVal / totalVar) * 100).toFixed(1)),
    ],
  };
}

function prettifyVarName(varName: string): string {
  return varName
    .replace(/_/g, ' ')
    .replace(/\b(usd|eur|mxn|cop|clp|pct|avg|prom|num)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildStrategicSegmentName(
  clusterId: number,
  zCentroid: Record<string, number>,
  variables: string[],
  context: BusinessContext,
  existingNames: Set<string>
): string {
  if (clusterId === -1) {
    return 'Observaciones Atípicas / Fuera de Densidad';
  }

  const unitPluralMap: Record<string, string> = {
    Cliente: 'Clientes',
    'Empresa / Cuenta B2B': 'Cuentas B2B',
    'Producto / SKU': 'Productos',
    'Sucursal / Punto de venta': 'Sucursales',
    'Transacción / Pedido': 'Operaciones',
    'Paciente / Usuario': 'Usuarios',
    'Otra unidad de análisis': 'Registros',
  };
  const unitNoun = unitPluralMap[context.observationUnit] ?? 'Segmento';

  const ranked = variables
    .map((v) => ({ v, z: zCentroid[v] ?? 0 }))
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z));

  const top1 = ranked[0];
  const top2 = ranked[1];

  const describeDriver = (item: { v: string; z: number }): string => {
    const clean = prettifyVarName(item.v);
    const shortName = clean.length > 22 ? clean.split(' ').slice(0, 2).join(' ') : clean;
    if (item.z >= 0.65) return `Alto ${shortName}`;
    if (item.z >= 0.25) return `${shortName} Sobre Promedio`;
    if (item.z <= -0.65) return `Bajo ${shortName}`;
    if (item.z <= -0.25) return `${shortName} Reducido`;
    return `${shortName} Moderado`;
  };

  let candidateName = `${unitNoun} de ${describeDriver(top1)}`;
  if (top2 && Math.abs(top2.z) >= 0.35) {
    candidateName = `${unitNoun}: ${describeDriver(top1)} y ${describeDriver(top2)}`;
  } else if (Math.abs(top1.z) < 0.35) {
    candidateName = `${unitNoun} de Comportamiento Promedio Equilibrado`;
  }

  // Ensure uniqueness without falling back to generic "Cluster 1"
  if (existingNames.has(candidateName)) {
    const top3 = ranked[2];
    if (top3) {
      candidateName = `${candidateName} (${describeDriver(top3)})`;
    }
  }
  if (existingNames.has(candidateName)) {
    const suffixes = ['Núcleo', 'Consolidado', 'Emergente', 'Especializado', 'Diferencial'];
    for (const suf of suffixes) {
      const alt = `${candidateName} · ${suf}`;
      if (!existingNames.has(alt)) {
        candidateName = alt;
        break;
      }
    }
  }

  existingNames.add(candidateName);
  return candidateName;
}

export function executeClusteringModel(
  prepared: PreparedDataResult,
  params: ClusteringRunParams,
  context: BusinessContext
): ClusteringModelResult {
  const data = prepared.scaledMatrix;
  const origData = prepared.originalMatrix;
  const n = data.length;
  const vars = prepared.variables;
  const p = vars.length;

  let rawLabels: number[] = [];
  let bic: number | undefined;
  let extraParams = '';
  let algorithmLabel = 'K-Means (K-Means++)';

  if (params.algorithm === 'kmeans') {
    const res = runKMeansRaw(data, params.k, params.seed, params.maxIterations, 10);
    rawLabels = res.labels;
    algorithmLabel = 'K-Means (Inicialización K-Means++)';
    extraParams = `max_iter=${params.maxIterations}, n_init=10`;
  } else if (params.algorithm === 'hierarchical') {
    rawLabels = runHierarchicalClustering(data, params.k, params.hierarchicalLinkage);
    algorithmLabel = `Clustering Jerárquico Aglomerativo (${params.hierarchicalLinkage})`;
    extraParams = `linkage=${params.hierarchicalLinkage}`;
  } else if (params.algorithm === 'dbscan') {
    rawLabels = runDbscan(data, params.dbscanEps, params.dbscanMinPts);
    algorithmLabel = 'DBSCAN (Densidad Espacial)';
    extraParams = `eps=${params.dbscanEps}, minPts=${params.dbscanMinPts}`;
  } else {
    const res = runGmmDiagonal(data, params.k, params.seed, 60);
    rawLabels = res.labels;
    bic = res.bic;
    algorithmLabel = 'Gaussian Mixture Model (EM Diagonal)';
    extraParams = `covarianza=diagonal, BIC=${res.bic}`;
  }

  // Reindex non-noise clusters sequentially 0..kEffective-1 sorted by descending size
  const countsMap = new Map<number, number>();
  let noiseCount = 0;
  rawLabels.forEach((lbl) => {
    if (lbl === -1) noiseCount++;
    else countsMap.set(lbl, (countsMap.get(lbl) ?? 0) + 1);
  });

  const sortedOrigClusterIds = Array.from(countsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cid]) => cid);

  const remap = new Map<number, number>();
  sortedOrigClusterIds.forEach((oldId, newIdx) => remap.set(oldId, newIdx));

  const labels = rawLabels.map((lbl) => (lbl === -1 ? -1 : remap.get(lbl) ?? 0));
  const kEffective = sortedOrigClusterIds.length;

  // Global original means and stds for standardized Z-score centroids (interpretable across variables!)
  const globalOrigMeans = Array(p).fill(0);
  const globalOrigStds = Array(p).fill(0);
  for (let j = 0; j < p; j++) {
    for (let i = 0; i < n; i++) globalOrigMeans[j] += origData[i][j];
    globalOrigMeans[j] /= Math.max(1, n);
    for (let i = 0; i < n; i++) {
      globalOrigStds[j] += Math.pow(origData[i][j] - globalOrigMeans[j], 2);
    }
    globalOrigStds[j] = Math.sqrt(globalOrigStds[j] / Math.max(1, n - 1)) || 1;
  }

  const allClusterIds = Array.from({ length: kEffective }, (_, i) => i);
  if (noiseCount > 0) allClusterIds.push(-1);

  const existingNames = new Set<string>();

  const clusterSummaries: ClusterSummary[] = allClusterIds.map((cid) => {
    const memberIdx: number[] = [];
    labels.forEach((l, i) => {
      if (l === cid) memberIdx.push(i);
    });
    const count = memberIdx.length;
    const percentage = n > 0 ? Number(((count / n) * 100).toFixed(1)) : 0;

    const originalCentroid: Record<string, number> = {};
    const originalMedian: Record<string, number> = {};
    const standardizedCentroid: Record<string, number> = {};

    vars.forEach((v, j) => {
      const vals = memberIdx.map((r) => origData[r][j]).sort((a, b) => a - b);
      const meanVal =
        vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      const medVal = quantile(vals, 0.5);
      const zVal = (meanVal - globalOrigMeans[j]) / globalOrigStds[j];

      originalCentroid[v] = Number(meanVal.toFixed(2));
      originalMedian[v] = Number(medVal.toFixed(2));
      standardizedCentroid[v] = Number(zVal.toFixed(3));
    });

    const strategicName = buildStrategicSegmentName(
      cid,
      standardizedCentroid,
      vars,
      context,
      existingNames
    );

    return {
      clusterId: cid,
      strategicName,
      count,
      percentage,
      standardizedCentroid,
      originalCentroid,
      originalMedian,
    };
  });

  const evalMetrics = computeClusterEvaluationMetrics(data, labels);
  const pca = computePca2D(data);

  const pcaPoints = pca.projected.map(([pc1, pc2], idx) => ({
    rowIndex: prepared.activeRowIndices[idx],
    pc1: Number(pc1.toFixed(3)),
    pc2: Number(pc2.toFixed(3)),
    clusterId: labels[idx],
  }));

  const pcaCentroids = allClusterIds
    .filter((cid) => cid >= 0)
    .map((cid) => {
      const pts = pcaPoints.filter((pt) => pt.clusterId === cid);
      const mean1 = pts.reduce((a, b) => a + b.pc1, 0) / Math.max(1, pts.length);
      const mean2 = pts.reduce((a, b) => a + b.pc2, 0) / Math.max(1, pts.length);
      return {
        clusterId: cid,
        pc1: Number(mean1.toFixed(3)),
        pc2: Number(mean2.toFixed(3)),
      };
    });

  return {
    algorithm: params.algorithm,
    algorithmLabel,
    kEffective,
    noiseCount,
    labels,
    clusterSummaries,
    silhouetteScore: evalMetrics.silhouette,
    calinskiHarabasz: evalMetrics.calinskiHarabasz,
    daviesBouldin: evalMetrics.daviesBouldin,
    inertia: evalMetrics.inertia,
    bic,
    pcaPoints,
    pcaCentroids,
    pcaExplainedVariance: pca.explainedRatio,
    parametersLog: {
      algorithm: algorithmLabel,
      k: kEffective,
      seed: params.seed,
      scaling: prepared.scalingMethod,
      variables: vars,
      extraParams,
      executedAt: new Date().toISOString(),
    },
  };
}
