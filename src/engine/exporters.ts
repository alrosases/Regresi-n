import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type {
  BusinessContext,
  BusinessStrategy,
  ClusteringModelResult,
  DescriptiveStats,
  OptimalKAnalysis,
  ParsedDataset,
  PreparedDataResult,
  SegmentProfile,
} from '../types/segmentation';

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCsvString(headers: string[], rows: (string | number)[][]): string {
  const escape = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.map(escape).join(',')];
  rows.forEach((r) => lines.push(r.map(escape).join(',')));
  return '\uFEFF' + lines.join('\n');
}

export function buildSegmentedOriginalRows(
  dataset: ParsedDataset,
  prepared: PreparedDataResult,
  model: ClusteringModelResult
): Record<string, unknown>[] {
  const nameByCluster = new Map<number, string>();
  model.clusterSummaries.forEach((s) => nameByCluster.set(s.clusterId, s.strategicName));

  const labelByOrigIdx = new Map<number, number>();
  prepared.activeRowIndices.forEach((origIdx, activePos) => {
    labelByOrigIdx.set(origIdx, model.labels[activePos]);
  });

  return dataset.rows.map((row, idx) => {
    const cid = labelByOrigIdx.get(idx);
    return {
      ...row,
      cluster_id: cid === undefined ? 'Excluido' : cid,
      segmento_estrategico:
        cid === undefined
          ? 'Excluido por datos faltantes'
          : (nameByCluster.get(cid) ?? `Segmento ${cid}`),
    };
  });
}

export function exportDatasetWithClustersCsv(
  dataset: ParsedDataset,
  prepared: PreparedDataResult,
  model: ClusteringModelResult
) {
  const rows = buildSegmentedOriginalRows(dataset, prepared, model);
  const headers = Object.keys(rows[0] ?? {});
  const body = rows.map((r) => headers.map((h) => String(r[h] ?? '')));
  const csv = toCsvString(headers, body);
  triggerBlobDownload(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    'dataset_segmentado.csv'
  );
}

export function exportProcessedDatasetCsv(
  prepared: PreparedDataResult,
  model: ClusteringModelResult
) {
  const nameByCluster = new Map<number, string>();
  model.clusterSummaries.forEach((s) => nameByCluster.set(s.clusterId, s.strategicName));

  const headers = [
    'indice_fila_original',
    ...prepared.variables.map((v) => `${v}_original`),
    ...prepared.variables.map((v) => `${v}_escalado`),
    'PC1',
    'PC2',
    'cluster_id',
    'segmento_estrategico',
  ];

  const body = prepared.activeRowIndices.map((origIdx, i) => {
    const cid = model.labels[i];
    const pca = model.pcaPoints[i];
    return [
      origIdx + 1,
      ...prepared.originalMatrix[i].map((v) => Number(v.toFixed(4))),
      ...prepared.scaledMatrix[i].map((v) => Number(v.toFixed(4))),
      pca?.pc1 ?? 0,
      pca?.pc2 ?? 0,
      cid,
      nameByCluster.get(cid) ?? '',
    ];
  });

  const csv = toCsvString(headers, body);
  triggerBlobDownload(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    'dataset_procesado_escalado.csv'
  );
}

export function exportCentroidsCsv(model: ClusteringModelResult, variables: string[]) {
  const headers = [
    'cluster_id',
    'segmento_estrategico',
    'registros',
    'participacion_pct',
    ...variables.map((v) => `${v}_media_original`),
    ...variables.map((v) => `${v}_mediana_original`),
    ...variables.map((v) => `${v}_zscore_estandarizado`),
  ];

  const body = model.clusterSummaries.map((s) => [
    s.clusterId,
    s.strategicName,
    s.count,
    s.percentage,
    ...variables.map((v) => s.originalCentroid[v] ?? 0),
    ...variables.map((v) => s.originalMedian[v] ?? 0),
    ...variables.map((v) => s.standardizedCentroid[v] ?? 0),
  ]);

  const csv = toCsvString(headers, body);
  triggerBlobDownload(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    'tabla_centroides.csv'
  );
}

export function exportCompleteExcelWorkbook(params: {
  dataset: ParsedDataset;
  context: BusinessContext;
  prepared: PreparedDataResult;
  descriptiveStats: DescriptiveStats[];
  optimalK: OptimalKAnalysis | null;
  model: ClusteringModelResult;
  profiles: SegmentProfile[];
  strategies: BusinessStrategy[];
}) {
  const {
    dataset,
    context,
    prepared,
    descriptiveStats,
    optimalK,
    model,
    profiles,
    strategies,
  } = params;

  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen Ejecutivo
  const summaryRows = [
    ['Criterio Analítica — Informe Ejecutivo de Segmentación', ''],
    ['Archivo analizado', dataset.fileName],
    ['Sector', context.sector],
    ['Unidad de análisis', context.observationUnit],
    ['Objetivo de segmentación', context.segmentationObjective],
    ['Registros totales / activos', `${dataset.rows.length} / ${prepared.activeRowIndices.length}`],
    ['Variables seleccionadas', prepared.variables.join(', ')],
    ['Escalamiento utilizado', prepared.scalingMethod === 'minmax' ? 'Min-Max [0, 1]' : 'Z-score'],
    ['Algoritmo ejecutado', model.algorithmLabel],
    ['Número efectivo de clusters', model.kEffective],
    ['Semilla de reproducibilidad', model.parametersLog.seed],
    ['Coeficiente de Silueta', model.silhouetteScore],
    ['Índice Calinski-Harabasz', model.calinskiHarabasz],
    ['Índice Davies-Bouldin', model.daviesBouldin],
    ['Varianza explicada PCA (PC1 + PC2)', `${model.pcaExplainedVariance[0]}% + ${model.pcaExplainedVariance[1]}%`],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Resumen Ejecutivo');

  // Sheet 2: Estadísticas Descriptivas
  const statsSheet = XLSX.utils.json_to_sheet(
    descriptiveStats.map((s) => ({
      Variable: s.variable,
      N: s.n,
      Faltantes: s.missing,
      Media: Number(s.mean.toFixed(3)),
      Mediana: Number(s.median.toFixed(3)),
      Desv_Est: Number(s.std.toFixed(3)),
      Minimo: Number(s.min.toFixed(3)),
      Q1: Number(s.q1.toFixed(3)),
      Q3: Number(s.q3.toFixed(3)),
      Maximo: Number(s.max.toFixed(3)),
      CV_Pct: Number(s.cvPct.toFixed(2)),
      Asimetria: Number(s.skewness.toFixed(3)),
      Curtosis: Number(s.kurtosis.toFixed(3)),
    }))
  );
  XLSX.utils.book_append_sheet(wb, statsSheet, 'Estadisticas Descriptivas');

  // Sheet 3: Centroides
  const centroidsSheet = XLSX.utils.json_to_sheet(
    model.clusterSummaries.map((s) => {
      const obj: Record<string, unknown> = {
        Cluster_ID: s.clusterId,
        Segmento_Estrategico: s.strategicName,
        Registros: s.count,
        Participacion_Pct: s.percentage,
      };
      prepared.variables.forEach((v) => {
        obj[`${v}_Original`] = s.originalCentroid[v];
        obj[`${v}_ZScore`] = s.standardizedCentroid[v];
      });
      return obj;
    })
  );
  XLSX.utils.book_append_sheet(wb, centroidsSheet, 'Centroides');

  // Sheet 4: Perfiles
  const profilesSheet = XLSX.utils.json_to_sheet(
    profiles.map((p) => ({
      Segmento: p.strategicName,
      Registros: p.count,
      Participacion_Pct: p.percentage,
      Caracteristicas: p.mainCharacteristics.join(' | '),
      Fortalezas: p.strengths.join(' | '),
      Debilidades: p.weaknesses.join(' | '),
      Necesidades: p.needs.join(' | '),
      Comportamiento: p.behavior,
      Potencial_Crecimiento: p.growthPotential,
      Riesgos: p.risks.join(' | '),
      Oportunidades: p.commercialOpportunities.join(' | '),
    }))
  );
  XLSX.utils.book_append_sheet(wb, profilesSheet, 'Perfiles Segmentos');

  // Sheet 5: Estrategias y Matriz Impacto-Esfuerzo
  const strategiesSheet = XLSX.utils.json_to_sheet(
    strategies.map((st) => ({
      Segmento: st.segmentName,
      Eje_Estrategico: st.strategicAxis,
      Problema_Oportunidad: st.problemOrOpportunity,
      Evidencia_Datos: st.dataEvidence,
      Estrategia_Propuesta: st.proposedStrategy,
      Mecanismo_Implementacion: st.implementationMechanism,
      Impacto_Esperado: st.expectedImpact,
      KPI: st.kpi,
      Riesgos_Supuestos: st.risksAndAssumptions,
      Horizonte: st.horizon,
      Impacto_1_10: st.impactScore,
      Esfuerzo_1_10: st.effortScore,
      Cuadrante_Matriz: st.quadrant,
      Responsable_Sugerido: st.suggestedOwner,
    }))
  );
  XLSX.utils.book_append_sheet(wb, strategiesSheet, 'Estrategias y Matriz');

  // Sheet 6: K Óptimo
  if (optimalK) {
    const kSheet = XLSX.utils.json_to_sheet(
      optimalK.metrics.map((m) => ({
        K: m.k,
        Inercia_WCSS: m.inertia,
        Silueta: m.silhouette,
        Gap_Statistic: m.gapStatistic,
        Gap_StdError: m.gapStdError,
        Calinski_Harabasz: m.calinskiHarabasz,
        Davies_Bouldin: m.daviesBouldin,
      }))
    );
    XLSX.utils.book_append_sheet(wb, kSheet, 'Evaluacion K Optimo');
  }

  // Sheet 7: Dataset con Segmento Asignado
  const segmentedRows = buildSegmentedOriginalRows(dataset, prepared, model);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(segmentedRows),
    'Datos Segmentados'
  );

  // Sheet 8: Trazabilidad
  const traceRows = [
    ['Bitácora de Transformaciones y Parámetros Reproducibles'],
    ...prepared.transformationLog.map((line) => [line]),
    ['Parámetros del Modelo', JSON.stringify(model.parametersLog)],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(traceRows), 'Trazabilidad');

  XLSX.writeFile(wb, 'informe_integral_segmentacion.xlsx');
}

export function exportExecutivePdfReport(params: {
  dataset: ParsedDataset;
  context: BusinessContext;
  prepared: PreparedDataResult;
  descriptiveStats: DescriptiveStats[];
  model: ClusteringModelResult;
  profiles: SegmentProfile[];
  strategies: BusinessStrategy[];
}) {
  const { dataset, context, prepared, descriptiveStats, model, profiles, strategies } =
    params;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text('Informe Ejecutivo de Segmentación y Estrategia', 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Archivo: ${dataset.fileName}  |  Sector: ${context.sector}  |  Unidad: ${context.observationUnit}`,
    14,
    25
  );
  doc.text(
    `Algoritmo: ${model.algorithmLabel}  |  Clusters: ${model.kEffective}  |  Silueta: ${model.silhouetteScore}  |  Semilla: ${model.parametersLog.seed}`,
    14,
    30
  );

  // Objective
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Objetivo de Negocio', 14, 38);
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  const objLines = doc.splitTextToSize(
    context.segmentationObjective || context.businessDescription || 'Segmentación estratégica de la base analizada.',
    182
  );
  doc.text(objLines, 14, 43);

  // Summary table of segments & centroids
  autoTable(doc, {
    startY: 54,
    head: [
      [
        'Segmento Estratégico',
        'Registros',
        '%',
        ...prepared.variables.slice(0, 4).map((v) => v),
      ],
    ],
    body: model.clusterSummaries.map((s) => [
      s.strategicName,
      s.count,
      `${s.percentage}%`,
      ...prepared.variables.slice(0, 4).map((v) => s.originalCentroid[v] ?? 0),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [29, 78, 216] },
  });

  // Descriptive stats
  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8,
    head: [['Variable', 'Media', 'Mediana', 'Desv. Est.', 'Mín', 'Máx', 'Asimetría']],
    body: descriptiveStats.map((d) => [
      d.variable,
      d.mean.toFixed(2),
      d.median.toFixed(2),
      d.std.toFixed(2),
      d.min.toFixed(2),
      d.max.toFixed(2),
      d.skewness.toFixed(2),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  // Page 2: Profiles & Prioritized Roadmap
  doc.addPage();
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('Perfiles Estratégicos y Hoja de Ruta Priorizada', 14, 16);

  autoTable(doc, {
    startY: 22,
    head: [['Segmento', 'Comportamiento y Oportunidad', 'Riesgo Principal']],
    body: profiles.map((p) => [
      `${p.strategicName} (${p.percentage}%)`,
      `${p.behavior} ${p.commercialOpportunities[0] ?? ''}`,
      p.risks[0] ?? '',
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [29, 78, 216] },
  });

  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8,
    head: [['Cuadrante', 'Segmento', 'Estrategia Propuesta', 'Imp/Esf', 'Plazo', 'KPI']],
    body: strategies
      .slice()
      .sort((a, b) => b.impactScore - a.effortScore - (a.impactScore - a.effortScore))
      .map((st) => [
        st.quadrant,
        st.segmentName,
        st.proposedStrategy,
        `${st.impactScore}/${st.effortScore}`,
        st.horizon,
        st.kpi,
      ]),
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [5, 150, 105] },
  });

  doc.save('informe_ejecutivo_segmentacion.pdf');
}
