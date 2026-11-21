import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ParsedDataset } from '../types/segmentation';

const CANDIDATE_DELIMITERS = [',', ';', '\t', '|'];

export function detectDelimiter(sampleText: string): string {
  const lines = sampleText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 20);

  if (lines.length === 0) return ',';

  let bestDelimiter = ',';
  let bestScore = -1;

  for (const delim of CANDIDATE_DELIMITERS) {
    const counts = lines.map((line) => {
      let inQuotes = false;
      let count = 0;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === delim && !inQuotes) {
          count++;
        }
      }
      return count;
    });

    const nonZero = counts.filter((c) => c > 0);
    if (nonZero.length === 0) continue;

    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance =
      counts.reduce((acc, c) => acc + Math.pow(c - avg, 2), 0) / counts.length;
    const consistency = 1 / (1 + variance);
    const score = avg * consistency * (nonZero.length / counts.length);

    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delim;
    }
  }

  return bestDelimiter;
}

export function formatDelimiterLabel(delim?: string): string {
  if (!delim) return 'N/A';
  if (delim === ',') return 'Coma (,)';
  if (delim === ';') return 'Punto y coma (;)';
  if (delim === '\t') return 'Tabulación (\\t)';
  if (delim === '|') return 'Barra vertical (|)';
  return delim;
}

function normalizeHeaders(rawHeaders: string[]): string[] {
  const seen = new Map<string, number>();
  return rawHeaders.map((h, idx) => {
    const cleaned = String(h ?? '').replace(/^\uFEFF/, '').trim() || `Columna_${idx + 1}`;
    const count = seen.get(cleaned) ?? 0;
    seen.set(cleaned, count + 1);
    return count === 0 ? cleaned : `${cleaned}_${count + 1}`;
  });
}

function parseDelimitedText(
  text: string,
  fileName: string,
  fileSizeBytes: number,
  fileFormat: string,
  forcedDelimiter?: string
): ParsedDataset {
  const cleanText = text.replace(/^\uFEFF/, '').trim();
  const delimiter = forcedDelimiter ?? detectDelimiter(cleanText);

  const parsed = Papa.parse<Record<string, unknown>>(cleanText, {
    header: true,
    delimiter,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  });

  const rawFields = parsed.meta.fields ?? [];
  const columns = normalizeHeaders(rawFields);

  const rows = (parsed.data ?? []).map((row) => {
    const normalizedRow: Record<string, unknown> = {};
    rawFields.forEach((origKey, idx) => {
      const targetKey = columns[idx];
      normalizedRow[targetKey] = row[origKey] ?? '';
    });
    return normalizedRow;
  });

  if (columns.length === 0 || rows.length === 0) {
    throw new Error('El archivo no contiene encabezados o registros tabulares válidos.');
  }

  return {
    fileName,
    fileSizeBytes,
    fileFormat,
    detectedSeparator: delimiter,
    columns,
    rows,
    loadedAt: new Date().toISOString(),
  };
}

export function extractSheetFromWorkbook(
  workbook: XLSX.WorkBook,
  sheetName: string,
  fileName: string,
  fileSizeBytes: number,
  fileFormat: string
): ParsedDataset {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`No se encontró la hoja "${sheetName}" en el libro de Excel.`);
  }

  const rawArray = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  const nonEmptyRows = rawArray.filter(
    (r) => Array.isArray(r) && r.some((cell) => String(cell ?? '').trim() !== '')
  );

  if (nonEmptyRows.length < 2) {
    throw new Error(`La hoja "${sheetName}" debe contener al menos una fila de encabezados y un registro.`);
  }

  const headerRow = nonEmptyRows[0].map((c) => String(c ?? ''));
  const columns = normalizeHeaders(headerRow);

  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < nonEmptyRows.length; i++) {
    const sourceRow = nonEmptyRows[i];
    const obj: Record<string, unknown> = {};
    columns.forEach((col, cIdx) => {
      obj[col] = sourceRow[cIdx] ?? '';
    });
    rows.push(obj);
  }

  return {
    fileName,
    fileSizeBytes,
    fileFormat,
    sheetNames: workbook.SheetNames,
    activeSheet: sheetName,
    columns,
    rows,
    rawWorkbook: workbook,
    loadedAt: new Date().toISOString(),
  };
}

export async function parseUploadedFile(file: File): Promise<ParsedDataset> {
  const lower = file.name.toLowerCase();
  const ext = lower.split('.').pop() ?? '';

  if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('El libro de Excel no contiene hojas.');
    }
    return extractSheetFromWorkbook(
      workbook,
      workbook.SheetNames[0],
      file.name,
      file.size,
      ext.toUpperCase()
    );
  }

  if (ext === 'json' || ext === 'ndjson') {
    const text = await file.text();
    const trimmed = text.trim();
    let records: Record<string, unknown>[] = [];
    if (ext === 'ndjson' || (!trimmed.startsWith('[') && trimmed.includes('\n'))) {
      records = trimmed
        .split(/\r?\n/)
        .filter((l) => l.trim().length > 0)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
    } else {
      const parsedJson = JSON.parse(trimmed);
      if (Array.isArray(parsedJson)) {
        records = parsedJson;
      } else if (parsedJson && typeof parsedJson === 'object') {
        const firstArray = Object.values(parsedJson).find((v) => Array.isArray(v));
        if (Array.isArray(firstArray)) {
          records = firstArray as Record<string, unknown>[];
        }
      }
    }

    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('El archivo JSON no contiene un arreglo de registros tabulares válido.');
    }

    const colSet = new Set<string>();
    records.forEach((r) => {
      if (r && typeof r === 'object') {
        Object.keys(r).forEach((k) => colSet.add(k));
      }
    });
    const columns = Array.from(colSet);
    const rows = records.map((r) => {
      const row: Record<string, unknown> = {};
      columns.forEach((c) => {
        const val = r?.[c];
        row[c] = val === undefined || val === null ? '' : typeof val === 'object' ? JSON.stringify(val) : val;
      });
      return row;
    });

    return {
      fileName: file.name,
      fileSizeBytes: file.size,
      fileFormat: ext.toUpperCase(),
      columns,
      rows,
      loadedAt: new Date().toISOString(),
    };
  }

  // CSV, TXT, TSV, DAT, etc.
  const text = await file.text();
  const forced = ext === 'tsv' ? '\t' : undefined;
  return parseDelimitedText(text, file.name, file.size, ext.toUpperCase() || 'CSV/TXT', forced);
}

export function buildParsedDatasetFromRecords(
  fileName: string,
  rows: Record<string, unknown>[]
): ParsedDataset {
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const approxBytes = JSON.stringify(rows).length;
  return {
    fileName,
    fileSizeBytes: approxBytes,
    fileFormat: 'CSV',
    detectedSeparator: ',',
    columns,
    rows,
    loadedAt: new Date().toISOString(),
  };
}
