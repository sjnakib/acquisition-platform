import ExcelJS from 'exceljs'

const COLUMN_MAP: Record<string, string> = {
  'Property Address':    'address',
  'City':               'city',
  'State':              'state',
  'Zip':                'zip',
  'Property Name':      'deal_name',
  'Property ID':        'property_id',
  'Building Class':     'building_class',
  'Year Built':         'year_built',
  'Number of Units':    'unit_count',
  'Property Type':      'property_type',
  'For Sale Price':     'asking_price',
  'CoStar Property URL': 'property_link',
}

export interface ParsedDeal {
  address?: string; city?: string; state?: string; zip?: string
  deal_name?: string; property_id?: string
  building_class?: string; year_built?: number; unit_count?: number
  property_type?: string; asking_price?: number; property_link?: string
}

export async function parseCoStarFile(buffer: ArrayBuffer): Promise<ParsedDeal[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const sheet = wb.worksheets[0]
  if (!sheet) throw new Error('No worksheet found in file')

  const headers: string[] = []
  const deals: ParsedDeal[] = []

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell) => headers.push(String(cell.value ?? '')))
      return
    }
    const obj: Record<string, unknown> = {}
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1]
      if (!header) return
      const mappedKey = COLUMN_MAP[header]
      if (mappedKey) obj[mappedKey] = cell.value
    })
    deals.push(obj as ParsedDeal)
  })

  return deals
}
