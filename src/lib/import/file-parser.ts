import ExcelJS from 'exceljs'
import Papa from 'papaparse'

export interface ParsedFile {
  headers: string[]
  rows: Record<string, string>[]
}

export async function parseFile(buffer: ArrayBuffer, filename: string): Promise<ParsedFile> {
  const isCsv = filename.toLowerCase().endsWith('.csv')
  return isCsv ? parseCsv(buffer) : parseXlsx(buffer)
}

function parseCsv(buffer: ArrayBuffer): ParsedFile {
  const text = new TextDecoder().decode(buffer)
  const result = Papa.parse<Record<string, string>>(text, {
    header: true, skipEmptyLines: true,
  })
  return {
    headers: result.meta.fields ?? [],
    rows: result.data,
  }
}

async function parseXlsx(buffer: ArrayBuffer): Promise<ParsedFile> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const sheet = wb.worksheets[0]
  if (!sheet) throw new Error('No worksheet found in file')

  const headers: string[] = []
  const rows: Record<string, string>[] = []

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell) => headers.push(String(extractCellValue(cell) ?? '').trim()))
      return
    }
    const obj: Record<string, string> = {}
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1]
      if (header) obj[header] = extractCellValue(cell) ?? ''
    })
    rows.push(obj)
  })

  return { headers, rows }
}

function extractCellValue(cell: ExcelJS.Cell): string | null {
  const val = cell.value
  if (val == null) return null

  // Formula cells: { formula: string, result: any } or { sharedFormula: string, result: any }
  if (typeof val === 'object' && 'result' in val) {
    return formatValue(val.result)
  }

  return formatValue(val)
}

function formatValue(val: ExcelJS.CellValue): string {
  if (val == null) return ''
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  if (typeof val === 'object') {
    // RichText: array of { text, ... }
    if (Array.isArray(val)) {
      return val
        .map((v) => (typeof v === 'object' && v !== null && 'text' in v ? String(v.text) : String(v)))
        .join('')
    }
    // CellErrorValue: { error: '#VALUE!' | '#REF!' | ... }
    if ('error' in val) return ''
    // CellHyperlinkValue: { text: string, hyperlink: string }
    if ('text' in val && 'hyperlink' in val) return String(val.text)
    // Unknown object — best-effort: try .text, else empty to avoid "[object Object]"
    if ('text' in val) return String((val as { text: unknown }).text)
    return ''
  }
  return String(val)
}
