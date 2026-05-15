import exceljs from 'exceljs';
import { importBatchSchema, importSchema } from '../validations/import.schema';
import { z } from 'zod';

type ImportSchema = z.infer<typeof importSchema>;

function normalizeHeader(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

const columnMapping: [RegExp | string, string][] = [
  [/^property\s*(id|#)$/i, 'property_id'],
  [/^(property|deal)\s*name$/i, 'deal_name'],
  [/^(property|asset)\s*type$/i, 'property_type'],
  [/^(building\s*)?class$/i, 'building_class'],
  [/^year\s*built$/i, 'year_built'],
  [/^year\s*renovated$/i, 'year_renovated'],
  [/^(number\s*(of\s*)?|#\s*of\s*|total\s*)?units?$/i, 'unit_count'],
  [/^property\s*(url|link)$/i, 'property_link'],
  [/^address$/i, 'address'],
  [/^city$/i, 'city'],
  [/^state$/i, 'state'],
  [/^(zip|zip\s*code|postal\s*code)$/i, 'zip'],
  [/^primary\s*contact\s*name$/i, 'contacts.0.name'],
  [/^primary\s*contact\s*company$/i, 'contacts.0.company'],
  [/^primary\s*contact\s*title$/i, 'contacts.0.title'],
  [/^primary\s*contact\s*email$/i, 'contacts.0.email.0'],
];

const numericFields = new Set(['year_built', 'year_renovated', 'unit_count']);
const enumLowerFields = new Set(['property_type', 'building_class']);

function findMapping(header: string): string | undefined {
  const norm = normalizeHeader(header);
  if (!norm) return undefined;
  for (const [pattern, target] of columnMapping) {
    if (typeof pattern === 'string') {
      if (pattern === norm) return target;
    } else {
      if (pattern.test(norm)) return target;
    }
  }
  return undefined;
}

/** Extract the last segment of a dotted path (e.g. "contacts.0.name" → "name") */
function leafField(path: string): string {
  const parts = path.split('.');
  return parts[parts.length - 1] ?? path;
}

/** Extract and coerce cell value to correct JS type for the target field */
function coerceCellValue(cell: exceljs.Cell, targetPath: string): unknown {
  const raw = cell.value;
  if (raw === null || raw === undefined) return undefined;

  const field = leafField(targetPath);

  // Rich text objects: use cell.text which is always a plain string
  if (typeof raw === 'object' && !(raw instanceof Date)) {
    const text = (cell.text ?? '').trim();
    if (!text) return undefined;
    if (numericFields.has(field)) {
      const n = Number(text);
      return isNaN(n) ? undefined : n;
    }
    return text;
  }

  // Dates
  if (raw instanceof Date) {
    if (numericFields.has(field)) {
      return raw.getFullYear();
    }
    return raw.toISOString().split('T')[0];
  }

  // Numeric fields from number cells
  if (numericFields.has(field)) {
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const n = Number(raw.trim());
      return isNaN(n) ? undefined : n;
    }
    return undefined;
  }

  // String fields
  let str: string;
  if (typeof raw === 'string') {
    str = raw.trim();
  } else if (typeof raw === 'number') {
    // Preserve full precision, avoid scientific notation
    str = String(raw);
  } else if (typeof raw === 'boolean') {
    str = String(raw);
  } else {
    str = String(raw).trim();
  }

  if (!str) return undefined;

  // Normalize enum values to lowercase to match Zod enum schemas
  if (enumLowerFields.has(field)) {
    // Strip parenthetical sub-type annotations: "multifamily (strip center)" → "multifamily"
    str = str.replace(/\s*\(.*?\)\s*/g, ' ').trim();
    str = str.toLowerCase();
    // Map common CoStar property type values to schema enums
    if (field === 'property_type') {
      const typeMap: Record<string, string> = {
        'multi-family': 'multifamily',
        'multi family': 'multifamily',
        'multi_family': 'multifamily',
        'garden': 'multifamily',
        'mixed use': 'mixed_use',
        'mixed-use': 'mixed_use',
        'retail store': 'retail',
        'office building': 'office',
        'industrial warehouse': 'industrial',
      };
      str = typeMap[str] ?? str;
    }
    if (field === 'building_class') {
      // Map full words like "class a" → "A", keep valid single letters, rest → unclassified
      const classMap: Record<string, string> = {
        'class a': 'A', 'class b': 'B', 'class c': 'C', 'class d': 'D',
      };
      str = classMap[str] ?? (str.length === 1 ? str.toUpperCase() : str);
      if (!['A', 'B', 'C', 'D'].includes(str)) str = 'unclassified';
    }
  }

  return str;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    if (i === keys.length - 1) {
      current[key] = value;
    } else {
      const nextKey = keys[i + 1];
      if (nextKey === '0') {
        if (!current[key]) current[key] = [{}];
        const arr = current[key] as Record<string, unknown>[];
        if (arr[0]) current = arr[0];
        i++;
      } else {
        if (!current[key]) current[key] = {};
        current = current[key] as Record<string, unknown>;
      }
    }
  }
}

export async function costarParser(buffer: ArrayBuffer): Promise<ImportSchema[]> {
  const workbook = new exceljs.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheet found');
  }

  const headerRow = worksheet.getRow(1);
  const colCount = worksheet.columnCount;
  const headers: string[] = [];
  for (let col = 1; col <= colCount; col++) {
    const cell = headerRow.getCell(col);
    const raw = cell.value;
    headers.push(typeof raw === 'string' ? raw : '');
  }

  console.log('[costar-parser] Headers found:', headers);

  const mappedHeaders = headers.map(h => findMapping(h));
  console.log('[costar-parser] Mapped paths:', mappedHeaders);

  const data: ImportSchema[] = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    let hasValues = false;
    const rowData: Record<string, unknown> = {};

    for (let col = 1; col <= colCount; col++) {
      const cell = row.getCell(col);
      const mappedPath = mappedHeaders[col - 1];
      if (!mappedPath) continue;

      const value = coerceCellValue(cell, mappedPath);
      if (value === undefined) continue;

      hasValues = true;
      setNestedValue(rowData, mappedPath, value);
    }

    if (hasValues) {
      data.push(rowData as ImportSchema);
    }
  }

  const validatedData = importBatchSchema.parse(data);
  return validatedData;
}
