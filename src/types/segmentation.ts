export type InferredColumnType =
  | 'Numérico entero'
  | 'Numérico decimal'
  | 'Texto'
  | 'Fecha'
  | 'Categórico'
  | 'Booleano';

export type BusinessSector =
  | 'Comercio y retail'
  | 'Banca y servicios financieros'
  | 'Telecomunicaciones'
  | 'Salud'
  | 'Educación'
  | 'Manufactura'
  | 'Transporte y logística'
  | 'Servicios profesionales'
  | 'Turismo y hotelería'
  | 'Tecnología'
  | 'Otro';

export type ObservationUnit =
  | 'Cliente'
  | 'Empresa / Cuenta B2B'
  | 'Producto / SKU'
  | 'Sucursal / Punto de venta'
  | 'Transacción / Pedido'
  | 'Paciente / Usuario'
  | 'Otra unidad de análisis';

export interface ParsedDataset {
  fileName: string;
  fileSizeBytes: number;
  fileFormat: string;
  detectedSeparator?: string;
  sheetNames?: string[];
  activeSheet?: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rawWorkbook?: unknown;
  loadedAt: string;
}

export interface ColumnDiagnostic {
  name: string;
  inferredType: InferredColumnType;
  totalCount: number;
  uniqueCount: number;
  missingCount: number;
  missingPct: number;
  isConstantOrLowVariance: boolean;
  topValueSharePct: number;
  isIdentifierLike: boolean;
  isDiscreteNumeric: boolean;
  isContinuousNumeric: boolean;
  isCandidate: boolean;
  candidateReason: string;
  sampleValues: string[];
}

export interface DatasetDiagnostics {
  rowCount: number;
  columnCount: number;
  duplicateRowCount: number;
  duplicateRowIndices: number[];
  totalMissingCells: number;
  totalMissingPct: number;
  columnDiagnostics: ColumnDiagnostic[];
  qualityAlerts: {
    severity: 'blocking' | 'warning' | 'info';
    title: string;
    detail: string;
  }[];
}

export interface BusinessContext {
  sector: BusinessSector;
  customSectorDetail: string;
  observationUnit: ObservationUnit;
  customUnitDetail: string;
  businessDescription: string;
  segmentationObjective: string;
  currencySymbol: string;
}

export interface DescriptiveStats {
  variable: string;
  n: number;
  missing: number;
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  iqr: number;
  p5: number;
  p10: number;
  p90: number;
  p95: number;
  cvPct: number;
  skewness: number;
  kurtosis: number;
  iqrOutlierCount: number;
  severeOutlierCount: number;
}

export interface BusinessRule {
  variable: string;
  observedMin: number;
  observedMax: number;
  suggestedMin: number;
  suggestedMax: number;
  customMin: number;
  customMax: number;
  belowMinCount: number;
  aboveMaxCount: number;
  impossibleCount: number;
  extremeRealCount: number;
  ruleRationale: string;
  userNote: string;
}

export interface DistributionAnalysis {
  variable: string;
  classification:
    | 'Simétrica'
    | 'Sesgo positivo'
    | 'Sesgo negativo'
    | 'Concentración anormal'
    | 'Multimodal / Dispersa';
  skewness: number;
  kurtosis: number;
  outlierCount: number;
  histogramBins: {
    x0: number;
    x1: number;
    count: number;
    density: number;
  }[];
  kdeCurve: { x: number; y: number }[];
  boxplot: {
    minWhisker: number;
    q1: number;
    median: number;
    q3: number;
    maxWhisker: number;
    outliers: number[];
  };
  clusteringImplication: string;
}

export type MissingStrategy =
  | 'keep_error'
  | 'impute_median'
  | 'impute_mean'
  | 'impute_zero'
  | 'drop_rows';

export type OutlierStrategy =
  | 'none'
  | 'winsor_1_99'
  | 'winsor_5_95'
  | 'iqr_cap';

export type MathTransform = 'none' | 'log1p' | 'sqrt' | 'signed_log';

export interface VariablePrepConfig {
  variable: string;
  missingStrategy: MissingStrategy;
  outlierStrategy: OutlierStrategy;
  mathTransform: MathTransform;
}

export type ScalingMethod = 'minmax' | 'zscore';

export interface ScalingFitParams {
  variable: string;
  min: number;
  max: number;
  mean: number;
  std: number;
}

export interface PreparedDataResult {
  variables: string[];
  activeRowIndices: number[];
  droppedRowCount: number;
  originalMatrix: number[][];
  transformedMatrix: number[][];
  scaledMatrix: number[][];
  scalingMethod: ScalingMethod;
  scalingParams: ScalingFitParams[];
  beforeStats: DescriptiveStats[];
  afterTransformStats: DescriptiveStats[];
  transformationLog: string[];
  hasRemainingMissing: boolean;
}

export interface OptimalKMetrics {
  k: number;
  inertia: number;
  silhouette: number;
  gapStatistic: number;
  gapStdError: number;
  calinskiHarabasz: number;
  daviesBouldin: number;
}

export interface OptimalKAnalysis {
  metrics: OptimalKMetrics[];
  elbowRecommendedK: number;
  silhouetteRecommendedK: number;
  gapRecommendedK: number;
  calinskiRecommendedK: number;
  daviesRecommendedK: number;
  consensusRecommendedK: number;
}

export type ClusteringAlgorithm =
  | 'kmeans'
  | 'hierarchical'
  | 'dbscan'
  | 'gmm';

export interface ClusteringRunParams {
  algorithm: ClusteringAlgorithm;
  k: number;
  seed: number;
  maxIterations: number;
  hierarchicalLinkage: 'ward' | 'complete' | 'average';
  dbscanEps: number;
  dbscanMinPts: number;
}

export interface ClusterSummary {
  clusterId: number; // -1 for DBSCAN noise
  strategicName: string;
  count: number;
  percentage: number;
  standardizedCentroid: Record<string, number>;
  originalCentroid: Record<string, number>;
  originalMedian: Record<string, number>;
}

export interface ClusteringModelResult {
  algorithm: ClusteringAlgorithm;
  algorithmLabel: string;
  kEffective: number;
  noiseCount: number;
  labels: number[]; // length == activeRowIndices.length
  clusterSummaries: ClusterSummary[];
  silhouetteScore: number;
  calinskiHarabasz: number;
  daviesBouldin: number;
  inertia: number;
  bic?: number;
  pcaPoints: {
    rowIndex: number;
    pc1: number;
    pc2: number;
    clusterId: number;
  }[];
  pcaCentroids: {
    clusterId: number;
    pc1: number;
    pc2: number;
  }[];
  pcaExplainedVariance: [number, number];
  parametersLog: {
    algorithm: string;
    k: number;
    seed: number;
    scaling: ScalingMethod;
    variables: string[];
    extraParams: string;
    executedAt: string;
  };
}

export interface SegmentProfile {
  clusterId: number;
  strategicName: string;
  color: string;
  count: number;
  percentage: number;
  mainCharacteristics: string[];
  differentiatingVariables: {
    variable: string;
    clusterMean: number;
    globalMean: number;
    zScore: number;
    pctDiffFromGlobal: number;
    direction: 'alto' | 'bajo' | 'neutro';
  }[];
  strengths: string[];
  weaknesses: string[];
  needs: string[];
  behavior: string;
  growthPotential: string;
  risks: string[];
  commercialOpportunities: string[];
}

export type MatrixQuadrant =
  | 'Alto Impacto / Bajo Esfuerzo'
  | 'Alto Impacto / Alto Esfuerzo'
  | 'Bajo Impacto / Bajo Esfuerzo'
  | 'Bajo Impacto / Alto Esfuerzo';

export interface BusinessStrategy {
  id: string;
  clusterId: number;
  segmentName: string;
  strategicAxis: string;
  problemOrOpportunity: string;
  dataEvidence: string;
  proposedStrategy: string;
  implementationMechanism: string;
  expectedImpact: string;
  kpi: string;
  risksAndAssumptions: string;
  horizon: 'Corto plazo (0-3 meses)' | 'Mediano plazo (3-9 meses)' | 'Largo plazo (9-18 meses)';
  impactScore: number; // 1 to 10
  effortScore: number; // 1 to 10
  quadrant: MatrixQuadrant;
  suggestedOwner: string;
  scoringRationale: string;
}

export type ModuleId =
  | 'mod-1-upload'
  | 'mod-2-explore'
  | 'mod-3-context'
  | 'mod-4-variables'
  | 'mod-5-descriptive'
  | 'mod-6-distributions'
  | 'mod-7-transformations'
  | 'mod-8-scaling'
  | 'mod-9-optimal-k'
  | 'mod-10-business-k'
  | 'mod-11-modeling'
  | 'mod-12-centroids'
  | 'mod-13-profiles'
  | 'mod-14-strategies'
  | 'mod-15-matrix'
  | 'mod-16-dashboard'
  | 'mod-17-export';
