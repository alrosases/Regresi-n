import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { formatDelimiterLabel } from '../../engine/fileParser';
import { SAMPLE_DATASETS } from '../../engine/sampleDatasets';
import type {
  BusinessContext,
  BusinessSector,
  DatasetDiagnostics,
  ObservationUnit,
  ParsedDataset,
} from '../../types/segmentation';

/* ============================================================================
   MÓDULO 1. CARGA DE ARCHIVOS
============================================================================ */
export const Module1Upload: React.FC<{
  dataset: ParsedDataset | null;
  isLoading: boolean;
  errorMsg: string | null;
  onFileSelected: (file: File) => void;
  onSelectSheet: (sheetName: string) => void;
  onLoadSample: (sampleId: string) => void;
  onNext: () => void;
}> = ({
  dataset,
  isLoading,
  errorMsg,
  onFileSelected,
  onSelectSheet,
  onLoadSample,
  onNext,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (files && files[0]) {
      onFileSelected(files[0]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <div className="text-xs font-medium text-blue-700">Módulo 01 · Ingesta de Datos</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Carga de Archivo y Detección de Estructura
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 max-w-3xl">
          Carga tu fuente tabular desde el computador en formato CSV, TXT, TSV, Excel (.xlsx, .xls, .ods) o JSON. El sistema detecta automáticamente el separador, identifica encabezados y te permite seleccionar la hoja de trabajo.
        </p>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragOver
            ? 'border-blue-600 bg-blue-50/50'
            : 'border-slate-300 bg-white hover:border-slate-400'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt,.tsv,.xlsx,.xls,.ods,.json,.ndjson"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Upload className="h-5 w-5" />
        </div>
        <h2 className="mt-3 text-base font-semibold text-slate-900">
          {dataset ? 'Cargar un archivo diferente sin reiniciar' : 'Selecciona o arrastra un archivo de datos'}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Formatos compatibles: CSV · TXT · TSV · Excel (.xlsx / .xls) · ODS · JSON tabular
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {isLoading ? 'Procesando archivo...' : dataset ? 'Reemplazar archivo' : 'Seleccionar archivo del computador'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <div>
            <div className="font-semibold">Error al procesar el archivo</div>
            <div className="mt-0.5 text-xs">{errorMsg}</div>
          </div>
        </div>
      )}

      {/* Confirmation Banner */}
      {dataset && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Archivo cargado correctamente: {dataset.fileName}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 font-mono tabular-nums">
                  <span>Formato: {dataset.fileFormat}</span>
                  <span aria-hidden="true">·</span>
                  <span>{dataset.rows.length.toLocaleString('es-ES')} filas</span>
                  <span aria-hidden="true">·</span>
                  <span>{dataset.columns.length} columnas</span>
                  {dataset.detectedSeparator && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Separador: {formatDelimiterLabel(dataset.detectedSeparator)}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>{(dataset.fileSizeBytes / 1024).toFixed(1)} KB</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onNext}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Continuar a Exploración Inicial
            </button>
          </div>

          {dataset.sheetNames && dataset.sheetNames.length > 0 && (
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
              <label className="text-xs font-medium text-slate-700" htmlFor="excel-sheet-select">
                Hoja de Excel seleccionada ({dataset.sheetNames.length} disponibles):
              </label>
              <select
                id="excel-sheet-select"
                value={dataset.activeSheet ?? dataset.sheetNames[0]}
                onChange={(e) => onSelectSheet(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {dataset.sheetNames.map((sheet) => (
                  <option key={sheet} value={sheet}>
                    {sheet}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100">
            <div className="text-xs font-medium text-slate-500 mb-1.5">
              Encabezados detectados ({dataset.columns.length}):
            </div>
            <div className="text-xs text-slate-700 leading-relaxed font-mono">
              {dataset.columns.join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* Optional real sample datasets for rapid testing */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Database className="h-4 w-4 text-slate-500" />
          <span>Datasets de referencia para prueba inmediata</span>
        </div>
        <p className="mt-1 text-xs text-slate-600">
          Si aún no tienes un archivo a mano, puedes cargar uno de estos conjuntos tabulares reales con valores faltantes, duplicados y variables mixtas para probar todos los módulos.
        </p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {SAMPLE_DATASETS.map((sample) => (
            <div
              key={sample.id}
              className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-4"
            >
              <div>
                <div className="text-sm font-semibold text-slate-900">{sample.title}</div>
                <p className="mt-1 text-xs text-slate-600">{sample.subtitle}</p>
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => onLoadSample(sample.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Cargar este dataset
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   MÓDULO 2. EXPLORACIÓN INICIAL DE LOS DATOS
============================================================================ */
export const Module2Explore: React.FC<{
  dataset: ParsedDataset;
  diagnostics: DatasetDiagnostics;
  onRemoveDuplicates: () => void;
  onNext: () => void;
}> = ({ dataset, diagnostics, onRemoveDuplicates, onNext }) => {
  const [previewMode, setPreviewMode] = useState<'head' | 'tail'>('head');
  const firstFive = dataset.rows.slice(0, 5);
  const lastFive = dataset.rows.slice(Math.max(0, dataset.rows.length - 5));
  const displayedRows = previewMode === 'head' ? firstFive : lastFive;
  const startIndex =
    previewMode === 'head' ? 1 : Math.max(1, dataset.rows.length - displayedRows.length + 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="text-xs font-medium text-blue-700">Módulo 02 · Diagnóstico Estructural</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Exploración Inicial y Calidad de Datos
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Inspección de registros, tipado automático de variables, detección de duplicados, valores faltantes y varianza mínima.
          </p>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Continuar a Contexto de Negocio
        </button>
      </div>

      {/* Summary KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Total de registros</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {diagnostics.rowCount.toLocaleString('es-ES')}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Variables totales</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {diagnostics.columnCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {diagnostics.columnDiagnostics.filter((c) => c.isCandidate).length} candidatas a clustering
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Celdas faltantes</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {diagnostics.totalMissingCells.toLocaleString('es-ES')}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {diagnostics.totalMissingPct.toFixed(2)}% del total de celdas
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Registros duplicados</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {diagnostics.duplicateRowCount}
          </div>
          {diagnostics.duplicateRowCount > 0 ? (
            <button
              type="button"
              onClick={onRemoveDuplicates}
              className="mt-1.5 text-xs font-medium text-blue-700 hover:underline cursor-pointer"
            >
              Depurar duplicados exactos
            </button>
          ) : (
            <div className="mt-1 text-xs text-emerald-700">Sin duplicados exactos</div>
          )}
        </div>
      </div>

      {/* Quality alerts */}
      {diagnostics.qualityAlerts.length > 0 && (
        <div className="space-y-2">
          {diagnostics.qualityAlerts.map((alert, i) => (
            <div
              key={i}
              className={`rounded-lg border p-3.5 text-xs flex items-start gap-3 ${
                alert.severity === 'blocking'
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : alert.severity === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : 'border-slate-200 bg-slate-100 text-slate-800'
              }`}
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">{alert.title}: </span>
                <span>{alert.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* First 5 / Last 5 rows */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-900">
            Vista previa de registros ({previewMode === 'head' ? 'Primeras 5 filas' : 'Últimas 5 filas'})
          </h2>
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setPreviewMode('head')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                previewMode === 'head'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Primeras 5 filas
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('tail')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                previewMode === 'tail'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Últimas 5 filas
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-600">
                <th className="px-3 py-2 text-left font-mono">#</th>
                {dataset.columns.map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-slate-400 tabular-nums">
                    {startIndex + idx}
                  </td>
                  {dataset.columns.map((col) => {
                    const val = String(row[col] ?? '');
                    return (
                      <td
                        key={col}
                        className="px-3 py-2 text-slate-800 whitespace-nowrap max-w-[200px] truncate tabular-nums"
                        title={val}
                      >
                        {val === '' ? <span className="text-amber-600 italic">vacío</span> : val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diagnostic Table of Variables */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-900">
            Tabla de Diagnóstico de Variables
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                <th className="px-3 py-2.5 text-left font-semibold">Variable</th>
                <th className="px-3 py-2.5 text-left font-semibold">Tipo detectado</th>
                <th className="px-3 py-2.5 text-right font-semibold">Únicos</th>
                <th className="px-3 py-2.5 text-right font-semibold">Faltantes</th>
                <th className="px-3 py-2.5 text-right font-semibold">% Faltantes</th>
                <th className="px-3 py-2.5 text-left font-semibold">Clasificación</th>
                <th className="px-3 py-2.5 text-left font-semibold">Justificación metodológica</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {diagnostics.columnDiagnostics.map((col) => (
                <tr key={col.name} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium text-slate-900 whitespace-nowrap">
                    {col.name}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                    {col.inferredType}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {col.uniqueCount.toLocaleString('es-ES')}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {col.missingCount}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {col.missingPct.toFixed(1)}%
                  </td>
                  <td
                    className={`px-3 py-2.5 font-semibold whitespace-nowrap ${
                      col.isCandidate ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {col.isCandidate ? 'Candidata' : 'No candidata'}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 max-w-md">
                    {col.candidateReason}
                  </td>
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
   MÓDULO 3. SECTOR Y CONTEXTO DE NEGOCIO
============================================================================ */
const SECTORS: BusinessSector[] = [
  'Comercio y retail',
  'Banca y servicios financieros',
  'Telecomunicaciones',
  'Salud',
  'Educación',
  'Manufactura',
  'Transporte y logística',
  'Servicios profesionales',
  'Turismo y hotelería',
  'Tecnología',
  'Otro',
];

const OBSERVATION_UNITS: ObservationUnit[] = [
  'Cliente',
  'Empresa / Cuenta B2B',
  'Producto / SKU',
  'Sucursal / Punto de venta',
  'Transacción / Pedido',
  'Paciente / Usuario',
  'Otra unidad de análisis',
];

export const Module3Context: React.FC<{
  context: BusinessContext;
  onChange: (next: BusinessContext) => void;
  onNext: () => void;
}> = ({ context, onChange, onNext }) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="text-xs font-medium text-blue-700">Módulo 03 · Marco Empresarial</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Sector, Unidad de Observación y Objetivo
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-3xl">
            Define qué representa exactamente cada fila del dataset y en qué industria opera. Todo el análisis descriptivo, las reglas de negocio, el nombramiento de segmentos y las estrategias se adaptarán a esta unidad de análisis.
          </p>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Continuar a Selección de Variables
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              Sector o industria principal
            </label>
            <select
              value={context.sector}
              onChange={(e) =>
                onChange({ ...context, sector: e.target.value as BusinessSector })
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {SECTORS.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>

          {context.sector === 'Otro' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Especifica el sector o subsector
              </label>
              <input
                type="text"
                value={context.customSectorDetail}
                onChange={(e) =>
                  onChange({ ...context, customSectorDetail: e.target.value })
                }
                placeholder="Ej. Energía renovable, Agroindustria, Medios..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              ¿Qué representa cada fila del dataset? (Unidad de análisis)
            </label>
            <select
              value={context.observationUnit}
              onChange={(e) =>
                onChange({
                  ...context,
                  observationUnit: e.target.value as ObservationUnit,
                })
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {OBSERVATION_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              No asumimos que los registros son clientes finales: si segmentas productos, sucursales, empresas B2B o transacciones, los perfiles y estrategias se formulan acorde a esa entidad.
            </p>
          </div>

          {context.observationUnit === 'Otra unidad de análisis' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Describe la unidad de observación
              </label>
              <input
                type="text"
                value={context.customUnitDetail}
                onChange={(e) =>
                  onChange({ ...context, customUnitDetail: e.target.value })
                }
                placeholder="Ej. Proveedor, Ruta logística, Póliza, Máquina industrial..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              Moneda o unidad de referencia económica
            </label>
            <select
              value={context.currencySymbol}
              onChange={(e) => onChange({ ...context, currencySymbol: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="$">$ (USD / MXN / COP / CLP)</option>
              <option value="€">€ (EUR)</option>
              <option value="S/">S/ (PEN)</option>
              <option value="£">£ (GBP)</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              Descripción breve del negocio / operación
            </label>
            <textarea
              rows={4}
              value={context.businessDescription}
              onChange={(e) =>
                onChange({ ...context, businessDescription: e.target.value })
              }
              placeholder="Describe el modelo de negocio, canales principales y naturaleza de la oferta..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              Objetivo estratégico de esta segmentación
            </label>
            <textarea
              rows={4}
              value={context.segmentationObjective}
              onChange={(e) =>
                onChange({ ...context, segmentationObjective: e.target.value })
              }
              placeholder="Ej. Identificar grupos por rentabilidad y riesgo de fuga, optimizar niveles de servicio, racionalizar portafolio..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
