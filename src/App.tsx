import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronRight,
  Lock,
  Menu,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Module1Upload,
  Module2Explore,
  Module3Context,
} from './components/modules/Phase1Ingestion';
import {
  Module4Variables,
  Module5DescriptiveAndRules,
  Module6Distributions,
  Module7Transformations,
  Module8Scaling,
} from './components/modules/Phase2Preparation';
import {
  Module9OptimalK,
  Module10BusinessK,
  Module11Modeling,
} from './components/modules/Phase3Clustering';
import {
  Module12Centroids,
  Module13Profiles,
  Module14Strategies,
  Module15Matrix,
  Module16Dashboard,
  Module17Export,
} from './components/modules/Phase4StrategyAndDashboard';
import {
  analyzeOptimalK,
  executeClusteringModel,
  suggestDbscanEps,
} from './engine/clustering';
import { diagnoseDataset } from './engine/dataDiagnostics';
import {
  computeDescriptiveStats,
  computeDistributionAnalyses,
  evaluateBusinessRuleCounts,
  generateInitialBusinessRules,
} from './engine/descriptiveAndRules';
import {
  buildParsedDatasetFromRecords,
  extractSheetFromWorkbook,
  parseUploadedFile,
} from './engine/fileParser';
import {
  buildSegmentProfiles,
  generateNonObviousStrategies,
} from './engine/interpretationAndStrategy';
import {
  buildDefaultPrepConfigs,
  prepareDataPipeline,
} from './engine/preprocessing';
import { SAMPLE_DATASETS } from './engine/sampleDatasets';
import { computeCorrelationAndVif } from './engine/variableSelection';
import type {
  BusinessContext,
  BusinessRule,
  BusinessStrategy,
  ClusteringModelResult,
  ClusteringRunParams,
  ModuleId,
  OptimalKAnalysis,
  ParsedDataset,
  ScalingMethod,
  VariablePrepConfig,
} from './types/segmentation';

interface NavModuleItem {
  id: ModuleId;
  num: string;
  label: string;
  phase: string;
}

const MODULES: NavModuleItem[] = [
  { id: 'mod-1-upload', num: '01', label: 'Carga de archivos', phase: 'Fase I · Ingesta y Contexto' },
  { id: 'mod-2-explore', num: '02', label: 'Exploración inicial', phase: 'Fase I · Ingesta y Contexto' },
  { id: 'mod-3-context', num: '03', label: 'Sector y contexto', phase: 'Fase I · Ingesta y Contexto' },

  { id: 'mod-4-variables', num: '04', label: 'Selección de variables', phase: 'Fase II · Diagnóstico y Datos' },
  { id: 'mod-5-descriptive', num: '05', label: 'Descriptivas y reglas', phase: 'Fase II · Diagnóstico y Datos' },
  { id: 'mod-6-distributions', num: '06', label: 'Distribuciones y sesgos', phase: 'Fase II · Diagnóstico y Datos' },
  { id: 'mod-7-transformations', num: '07', label: 'Transformaciones', phase: 'Fase II · Diagnóstico y Datos' },
  { id: 'mod-8-scaling', num: '08', label: 'Estandarización', phase: 'Fase II · Diagnóstico y Datos' },

  { id: 'mod-9-optimal-k', num: '09', label: 'K óptimo (Codo/Silueta/Gap)', phase: 'Fase III · Modelado' },
  { id: 'mod-10-business-k', num: '10', label: 'K según el negocio', phase: 'Fase III · Modelado' },
  { id: 'mod-11-modeling', num: '11', label: 'Ejecución de clustering', phase: 'Fase III · Modelado' },

  { id: 'mod-12-centroids', num: '12', label: 'Análisis de centroides', phase: 'Fase IV · Estrategia' },
  { id: 'mod-13-profiles', num: '13', label: 'Perfiles de segmentos', phase: 'Fase IV · Estrategia' },
  { id: 'mod-14-strategies', num: '14', label: 'Estrategias no obvias', phase: 'Fase IV · Estrategia' },
  { id: 'mod-15-matrix', num: '15', label: 'Matriz impacto y esfuerzo', phase: 'Fase IV · Estrategia' },

  { id: 'mod-16-dashboard', num: '16', label: 'Dashboard ejecutivo', phase: 'Fase V · Síntesis y Salida' },
  { id: 'mod-17-export', num: '17', label: 'Exportación de resultados', phase: 'Fase V · Síntesis y Salida' },
];

const DEFAULT_CONTEXT: BusinessContext = {
  sector: 'Comercio y retail',
  customSectorDetail: '',
  observationUnit: 'Cliente',
  customUnitDetail: '',
  businessDescription: '',
  segmentationObjective: '',
  currencySymbol: '$',
};

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>('mod-1-upload');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Module 1 state
  const [dataset, setDataset] = useState<ParsedDataset | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Module 3 state
  const [businessContext, setBusinessContext] = useState<BusinessContext>(DEFAULT_CONTEXT);

  // Module 4 state
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);

  // Module 5 state
  const [businessRules, setBusinessRules] = useState<BusinessRule[]>([]);

  // Module 7 & 8 state
  const [prepConfigs, setPrepConfigs] = useState<VariablePrepConfig[]>([]);
  const [scalingMethod, setScalingMethod] = useState<ScalingMethod>('zscore');

  // Module 9, 10, 11 state
  const [optimalKAnalysis, setOptimalKAnalysis] = useState<OptimalKAnalysis | null>(null);
  const [isComputingOptimalK, setIsComputingOptimalK] = useState(false);
  const [runParams, setRunParams] = useState<ClusteringRunParams>({
    algorithm: 'kmeans',
    k: 4,
    seed: 42,
    maxIterations: 100,
    hierarchicalLinkage: 'ward',
    dbscanEps: 0.85,
    dbscanMinPts: 5,
  });
  const [activeModel, setActiveModel] = useState<ClusteringModelResult | null>(null);

  // Module 14 & 15 state
  const [strategies, setStrategies] = useState<BusinessStrategy[]>([]);

  // Derived Module 2 Diagnostics
  const diagnostics = useMemo(() => {
    if (!dataset) return null;
    return diagnoseDataset(dataset);
  }, [dataset]);

  // Helper to initialize downstream defaults whenever a new dataset/sheet is loaded
  const initializeFromDataset = useCallback(
    (nextDataset: ParsedDataset, nextContext?: BusinessContext) => {
      const diag = diagnoseDataset(nextDataset);
      const recommendedVars = diag.columnDiagnostics
        .filter((c) => c.isCandidate && c.isContinuousNumeric)
        .map((c) => c.name);
      const fallbackVars =
        recommendedVars.length >= 2
          ? recommendedVars
          : diag.columnDiagnostics.filter((c) => c.isCandidate).map((c) => c.name);

      const ctx = nextContext ?? businessContext;
      setDataset(nextDataset);
      if (nextContext) setBusinessContext(nextContext);
      setSelectedVariables(fallbackVars);
      setPrepConfigs(buildDefaultPrepConfigs(fallbackVars));

      const stats = computeDescriptiveStats(nextDataset, fallbackVars);
      setBusinessRules(generateInitialBusinessRules(nextDataset, stats, ctx));
      setOptimalKAnalysis(null);
      setActiveModel(null);
      setStrategies([]);
    },
    [businessContext]
  );

  // File upload handler (Module 1)
  const handleFileSelected = async (file: File) => {
    setIsLoadingFile(true);
    setUploadError(null);
    try {
      const parsed = await parseUploadedFile(file);
      initializeFromDataset(parsed);
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : 'No se pudo interpretar el archivo seleccionado.'
      );
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleSelectExcelSheet = (sheetName: string) => {
    if (!dataset?.rawWorkbook) return;
    setUploadError(null);
    try {
      const next = extractSheetFromWorkbook(
        dataset.rawWorkbook as XLSX.WorkBook,
        sheetName,
        dataset.fileName,
        dataset.fileSizeBytes,
        dataset.fileFormat
      );
      initializeFromDataset(next);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al cambiar de hoja.');
    }
  };

  const handleLoadSample = (sampleId: string) => {
    const found = SAMPLE_DATASETS.find((s) => s.id === sampleId);
    if (!found) return;
    setUploadError(null);
    const rows = found.buildRows();
    const parsed = buildParsedDatasetFromRecords(found.fileName, rows);
    initializeFromDataset(parsed, found.suggestedContext);
    setActiveModule('mod-2-explore');
  };

  const handleRemoveDuplicates = () => {
    if (!dataset || !diagnostics || diagnostics.duplicateRowIndices.length === 0) return;
    const dupSet = new Set(diagnostics.duplicateRowIndices);
    const cleanedRows = dataset.rows.filter((_, idx) => !dupSet.has(idx));
    const updated: ParsedDataset = { ...dataset, rows: cleanedRows };
    setDataset(updated);
  };

  // Module 4: Correlation & VIF
  const correlationResult = useMemo(() => {
    if (!dataset || selectedVariables.length === 0) {
      return { variables: [], matrix: [], highCorrelationPairs: [], vifByVariable: {} };
    }
    return computeCorrelationAndVif(dataset, selectedVariables);
  }, [dataset, selectedVariables]);

  // Sync prepConfigs & businessRules when selectedVariables changes
  useEffect(() => {
    if (!dataset) return;
    setPrepConfigs((prev) => {
      const prevMap = new Map(prev.map((c) => [c.variable, c]));
      return selectedVariables.map(
        (v) =>
          prevMap.get(v) ?? {
            variable: v,
            missingStrategy: 'impute_median',
            outlierStrategy: 'none',
            mathTransform: 'none',
          }
      );
    });

    const stats = computeDescriptiveStats(dataset, selectedVariables);
    setBusinessRules((prev) => {
      const prevMap = new Map(prev.map((r) => [r.variable, r]));
      const defaults = generateInitialBusinessRules(dataset, stats, businessContext);
      return defaults.map((def) => {
        const existing = prevMap.get(def.variable);
        if (!existing) return def;
        const st = stats.find((s) => s.variable === def.variable)!;
        return evaluateBusinessRuleCounts(dataset, st, existing);
      });
    });

    setOptimalKAnalysis(null);
    setActiveModel(null);
  }, [dataset, selectedVariables, businessContext]);

  const handleToggleVariable = (varName: string) => {
    setSelectedVariables((prev) =>
      prev.includes(varName) ? prev.filter((v) => v !== varName) : [...prev, varName]
    );
  };

  const handleSelectAllRecommended = () => {
    if (!diagnostics) return;
    const rec = diagnostics.columnDiagnostics
      .filter((c) => c.isCandidate && c.isContinuousNumeric)
      .map((c) => c.name);
    setSelectedVariables(rec);
  };

  // Module 5 & 6: Descriptive stats & distributions
  const descriptiveStats = useMemo(() => {
    if (!dataset || selectedVariables.length === 0) return [];
    return computeDescriptiveStats(dataset, selectedVariables);
  }, [dataset, selectedVariables]);

  const distributions = useMemo(() => {
    if (!dataset || descriptiveStats.length === 0) return [];
    return computeDistributionAnalyses(dataset, descriptiveStats);
  }, [dataset, descriptiveStats]);

  const handleUpdateBusinessRule = (
    variable: string,
    nextMin: number,
    nextMax: number,
    userNote: string
  ) => {
    if (!dataset) return;
    setBusinessRules((prev) =>
      prev.map((rule) => {
        if (rule.variable !== variable) return rule;
        const stat = descriptiveStats.find((s) => s.variable === variable);
        const updated: BusinessRule = {
          ...rule,
          customMin: nextMin,
          customMax: nextMax,
          userNote,
        };
        return stat ? evaluateBusinessRuleCounts(dataset, stat, updated) : updated;
      })
    );
  };

  // Module 7 & 8: Prepared data pipeline
  const preparedData = useMemo(() => {
    if (!dataset || prepConfigs.length === 0) {
      return prepareDataPipeline(
        dataset ?? {
          fileName: '',
          fileSizeBytes: 0,
          fileFormat: '',
          columns: [],
          rows: [],
          loadedAt: '',
        },
        [],
        scalingMethod
      );
    }
    return prepareDataPipeline(dataset, prepConfigs, scalingMethod);
  }, [dataset, prepConfigs, scalingMethod]);

  const handleUpdatePrepConfig = (variable: string, patch: Partial<VariablePrepConfig>) => {
    setPrepConfigs((prev) =>
      prev.map((c) => (c.variable === variable ? { ...c, ...patch } : c))
    );
    setOptimalKAnalysis(null);
    setActiveModel(null);
  };

  const handleApplyRecommendedSkewFix = () => {
    const statsMap = new Map(descriptiveStats.map((s) => [s.variable, s]));
    setPrepConfigs((prev) =>
      prev.map((cfg) => {
        const st = statsMap.get(cfg.variable);
        if (!st || Math.abs(st.skewness) < 1) return cfg;
        return {
          ...cfg,
          mathTransform: st.min >= 0 ? 'log1p' : 'signed_log',
        };
      })
    );
    setOptimalKAnalysis(null);
    setActiveModel(null);
  };

  // Module 9: Optimal K computation
  const recomputeOptimalK = useCallback(() => {
    if (
      preparedData.scaledMatrix.length < 6 ||
      preparedData.hasRemainingMissing ||
      selectedVariables.length < 2
    ) {
      return;
    }
    setIsComputingOptimalK(true);
    // Defer slightly to let React paint loading state if needed
    setTimeout(() => {
      const analysis = analyzeOptimalK(preparedData, runParams.seed, 8);
      setOptimalKAnalysis(analysis);
      setRunParams((prev) => ({
        ...prev,
        k: analysis.consensusRecommendedK,
        dbscanEps: suggestDbscanEps(preparedData.scaledMatrix, prev.dbscanMinPts),
      }));
      setIsComputingOptimalK(false);
    }, 10);
  }, [preparedData, runParams.seed, selectedVariables.length]);

  // Module 11: Model execution
  const executeActiveClustering = useCallback(
    (overrideParams?: ClusteringRunParams) => {
      if (preparedData.scaledMatrix.length < 4 || preparedData.hasRemainingMissing) return;
      const effectiveParams = overrideParams ?? runParams;
      const model = executeClusteringModel(preparedData, effectiveParams, businessContext);
      setActiveModel(model);
      const profs = buildSegmentProfiles(model, descriptiveStats, businessContext);
      setStrategies(generateNonObviousStrategies(profs, businessContext));
    },
    [preparedData, runParams, businessContext, descriptiveStats]
  );

  // Automatically compute Optimal K when entering Module 9 if not yet computed
  useEffect(() => {
    if (activeModule === 'mod-9-optimal-k' && !optimalKAnalysis && !isComputingOptimalK) {
      recomputeOptimalK();
    }
  }, [activeModule, optimalKAnalysis, isComputingOptimalK, recomputeOptimalK]);

  // Automatically execute model when entering Module 11+ if none exists yet
  useEffect(() => {
    if (
      (activeModule === 'mod-11-modeling' ||
        activeModule === 'mod-12-centroids' ||
        activeModule === 'mod-13-profiles' ||
        activeModule === 'mod-14-strategies' ||
        activeModule === 'mod-15-matrix' ||
        activeModule === 'mod-16-dashboard' ||
        activeModule === 'mod-17-export') &&
      !activeModel &&
      preparedData.scaledMatrix.length >= 4 &&
      !preparedData.hasRemainingMissing
    ) {
      executeActiveClustering();
    }
  }, [activeModule, activeModel, preparedData, executeActiveClustering]);

  // Profiles derived from activeModel (stays synced if user renames segments in Module 12!)
  const profiles = useMemo(() => {
    if (!activeModel) return [];
    return buildSegmentProfiles(activeModel, descriptiveStats, businessContext);
  }, [activeModel, descriptiveStats, businessContext]);

  const handleRenameSegment = (clusterId: number, newName: string) => {
    if (!activeModel) return;
    setActiveModel({
      ...activeModel,
      clusterSummaries: activeModel.clusterSummaries.map((s) =>
        s.clusterId === clusterId ? { ...s, strategicName: newName } : s
      ),
    });
    setStrategies((prev) =>
      prev.map((st) => (st.clusterId === clusterId ? { ...st, segmentName: newName } : st))
    );
  };

  const handleUpdateStrategy = (id: string, patch: Partial<BusinessStrategy>) => {
    setStrategies((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleAddStrategy = (strategy: BusinessStrategy) => {
    setStrategies((prev) => [strategy, ...prev]);
  };

  // Quality Gate Lock Check
  const isModuleAccessible = (id: ModuleId): { ok: boolean; reason?: string } => {
    if (id === 'mod-1-upload') return { ok: true };
    if (!dataset) return { ok: false, reason: 'Carga primero un archivo de datos.' };
    if (id === 'mod-2-explore' || id === 'mod-3-context' || id === 'mod-4-variables') {
      return { ok: true };
    }
    if (selectedVariables.length < 2) {
      return { ok: false, reason: 'Selecciona al menos 2 variables numéricas en el Módulo 04.' };
    }
    if (id === 'mod-5-descriptive' || id === 'mod-6-distributions' || id === 'mod-7-transformations') {
      return { ok: true };
    }
    if (preparedData.hasRemainingMissing) {
      return {
        ok: false,
        reason: 'Trata los valores faltantes en el Módulo 07 antes de modelar.',
      };
    }
    if (preparedData.activeRowIndices.length < 6) {
      return {
        ok: false,
        reason: 'Se requieren al menos 6 registros activos válidos para segmentar.',
      };
    }
    return { ok: true };
  };

  const navigateTo = (id: ModuleId) => {
    const check = isModuleAccessible(id);
    if (!check.ok) return;
    setActiveModule(id);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentModInfo = MODULES.find((m) => m.id === activeModule) ?? MODULES[0];
  const phases = Array.from(new Set(MODULES.map((m) => m.phase)));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3-zone single row */}
      <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-8">
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Abrir navegación de módulos"
            className="lg:hidden p-1.5 rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            Criterio Analítica
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-2 text-xs text-slate-500 min-w-0 truncate">
          <span className="truncate">{currentModInfo.phase}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="font-medium text-slate-900 truncate">
            {currentModInfo.num}. {currentModInfo.label}
          </span>
          {dataset && (
            <>
              <span aria-hidden="true" className="mx-1 text-slate-300">
                ·
              </span>
              <span className="font-mono text-slate-600 truncate max-w-[200px]">
                {dataset.fileName}
              </span>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (activeModel && activeModule !== 'mod-16-dashboard') {
                navigateTo('mod-16-dashboard');
              } else {
                navigateTo('mod-1-upload');
              }
            }}
            className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {activeModel && activeModule !== 'mod-16-dashboard'
              ? 'Ver Dashboard'
              : 'Cargar Archivo'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex relative">
        {/* Sidebar Navigation */}
        <aside
          className={`${
            mobileMenuOpen ? 'fixed inset-y-14 left-0 z-20 block' : 'hidden'
          } lg:block w-[272px] shrink-0 bg-white border-r border-slate-200 overflow-y-auto`}
        >
          <div className="p-4 space-y-5">
            {phases.map((phaseName) => {
              const items = MODULES.filter((m) => m.phase === phaseName);
              return (
                <div key={phaseName} className="space-y-1">
                  <div className="px-2.5 text-[11px] font-semibold text-slate-500">
                    {phaseName}
                  </div>
                  <div className="space-y-0.5">
                    {items.map((item) => {
                      const access = isModuleAccessible(item.id);
                      const isActive = activeModule === item.id;
                      const currentIdx = MODULES.findIndex((m) => m.id === activeModule);
                      const itemIdx = MODULES.findIndex((m) => m.id === item.id);
                      const isCompleted = access.ok && itemIdx < currentIdx;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={!access.ok}
                          title={access.reason}
                          onClick={() => navigateTo(item.id)}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
                            isActive
                              ? 'bg-blue-50 text-blue-800 font-semibold'
                              : access.ok
                                ? 'text-slate-700 hover:bg-slate-100 cursor-pointer'
                                : 'text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[11px] tabular-nums opacity-75 shrink-0">
                              {item.num}
                            </span>
                            <span className="truncate">{item.label}</span>
                          </span>
                          {!access.ok ? (
                            <Lock className="h-3 w-3 shrink-0 opacity-50" />
                          ) : isCompleted ? (
                            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 p-5 sm:p-8 max-w-[1220px] mx-auto w-full">
          {/* Quality Gate Warning Banner if user has blocking issues */}
          {dataset && diagnostics && selectedVariables.length < 2 && activeModule !== 'mod-4-variables' && activeModule !== 'mod-1-upload' && activeModule !== 'mod-2-explore' && activeModule !== 'mod-3-context' && (
            <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-900">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>
                No hay suficientes variables numéricas seleccionadas. Regresa al Módulo 04 para continuar.
              </span>
            </div>
          )}

          {activeModule === 'mod-1-upload' && (
            <Module1Upload
              dataset={dataset}
              isLoading={isLoadingFile}
              errorMsg={uploadError}
              onFileSelected={handleFileSelected}
              onSelectSheet={handleSelectExcelSheet}
              onLoadSample={handleLoadSample}
              onNext={() => navigateTo('mod-2-explore')}
            />
          )}

          {activeModule === 'mod-2-explore' && dataset && diagnostics && (
            <Module2Explore
              dataset={dataset}
              diagnostics={diagnostics}
              onRemoveDuplicates={handleRemoveDuplicates}
              onNext={() => navigateTo('mod-3-context')}
            />
          )}

          {activeModule === 'mod-3-context' && (
            <Module3Context
              context={businessContext}
              onChange={setBusinessContext}
              onNext={() => navigateTo('mod-4-variables')}
            />
          )}

          {activeModule === 'mod-4-variables' && diagnostics && (
            <Module4Variables
              diagnostics={diagnostics}
              selectedVariables={selectedVariables}
              correlationResult={correlationResult}
              onToggleVariable={handleToggleVariable}
              onSelectAllRecommended={handleSelectAllRecommended}
              onNext={() => navigateTo('mod-5-descriptive')}
            />
          )}

          {activeModule === 'mod-5-descriptive' && (
            <Module5DescriptiveAndRules
              stats={descriptiveStats}
              rules={businessRules}
              context={businessContext}
              onUpdateRule={handleUpdateBusinessRule}
              onNext={() => navigateTo('mod-6-distributions')}
            />
          )}

          {activeModule === 'mod-6-distributions' && dataset && (
            <Module6Distributions
              dataset={dataset}
              stats={descriptiveStats}
              distributions={distributions}
              onNext={() => navigateTo('mod-7-transformations')}
            />
          )}

          {activeModule === 'mod-7-transformations' && (
            <Module7Transformations
              configs={prepConfigs}
              prepared={preparedData}
              onUpdateConfig={handleUpdatePrepConfig}
              onApplyRecommendedSkewFix={handleApplyRecommendedSkewFix}
              onNext={() => navigateTo('mod-8-scaling')}
            />
          )}

          {activeModule === 'mod-8-scaling' && (
            <Module8Scaling
              scalingMethod={scalingMethod}
              prepared={preparedData}
              onChangeScaling={(method) => {
                setScalingMethod(method);
                setOptimalKAnalysis(null);
                setActiveModel(null);
              }}
              onNext={() => navigateTo('mod-9-optimal-k')}
            />
          )}

          {activeModule === 'mod-9-optimal-k' && (
            <Module9OptimalK
              analysis={optimalKAnalysis}
              isComputing={isComputingOptimalK}
              onRecompute={recomputeOptimalK}
              onNext={() => navigateTo('mod-10-business-k')}
            />
          )}

          {activeModule === 'mod-10-business-k' && (
            <Module10BusinessK
              analysis={optimalKAnalysis}
              prepared={preparedData}
              context={businessContext}
              selectedK={runParams.k}
              seed={runParams.seed}
              onChangeK={(k) => {
                setRunParams((prev) => ({ ...prev, k }));
                setActiveModel(null);
              }}
              onNext={() => navigateTo('mod-11-modeling')}
            />
          )}

          {activeModule === 'mod-11-modeling' && (
            <Module11Modeling
              prepared={preparedData}
              context={businessContext}
              params={runParams}
              activeModel={activeModel}
              onUpdateParams={(patch) => {
                const next = { ...runParams, ...patch };
                setRunParams(next);
                executeActiveClustering(next);
              }}
              onRunModel={() => executeActiveClustering()}
              onNext={() => navigateTo('mod-12-centroids')}
            />
          )}

          {activeModule === 'mod-12-centroids' && activeModel && (
            <Module12Centroids
              model={activeModel}
              variables={preparedData.variables}
              globalStats={descriptiveStats}
              onRenameSegment={handleRenameSegment}
              onNext={() => navigateTo('mod-13-profiles')}
            />
          )}

          {activeModule === 'mod-13-profiles' && activeModel && (
            <Module13Profiles
              profiles={profiles}
              onNext={() => navigateTo('mod-14-strategies')}
            />
          )}

          {activeModule === 'mod-14-strategies' && activeModel && (
            <Module14Strategies
              strategies={strategies}
              profiles={profiles}
              onUpdateStrategy={handleUpdateStrategy}
              onAddStrategy={handleAddStrategy}
              onNext={() => navigateTo('mod-15-matrix')}
            />
          )}

          {activeModule === 'mod-15-matrix' && activeModel && (
            <Module15Matrix
              strategies={strategies}
              onUpdateStrategy={handleUpdateStrategy}
              onNext={() => navigateTo('mod-16-dashboard')}
            />
          )}

          {activeModule === 'mod-16-dashboard' && dataset && activeModel && (
            <Module16Dashboard
              dataset={dataset}
              context={businessContext}
              prepared={preparedData}
              model={activeModel}
              profiles={profiles}
              strategies={strategies}
              onGoToExport={() => navigateTo('mod-17-export')}
            />
          )}

          {activeModule === 'mod-17-export' && dataset && activeModel && (
            <Module17Export
              dataset={dataset}
              context={businessContext}
              prepared={preparedData}
              descriptiveStats={descriptiveStats}
              optimalK={optimalKAnalysis}
              model={activeModel}
              profiles={profiles}
              strategies={strategies}
            />
          )}
        </main>
      </div>
    </div>
  );
}
