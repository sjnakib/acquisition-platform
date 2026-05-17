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
      row.eachCell((cell) => headers.push(String(cell.value ?? '').trim()))
      return
    }
    const obj: Record<string, string> = {}
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1]
      if (header) obj[header] = cell.value == null ? '' : String(cell.value)
    })
    rows.push(obj)
  })

  return { headers, rows }
}
