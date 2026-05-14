import exceljs from 'exceljs';
import { importBatchSchema, importSchema } from '../validations/import.schema';
import { z } from 'zod';

type ImportSchema = z.infer<typeof importSchema>;

// This is a simplified mapping. A real implementation would need to be more robust.
const columnMapping: Record<string, string> = {
  'Property ID': 'property_id',
  'Property Name': 'deal_name',
  'Property Type': 'property_type',
  'Building Class': 'building_class',
  'Year Built': 'year_built',
  'Year Renovated': 'year_renovated',
  'Number Of Units': 'unit_count',
  'Property URL': 'property_link',
  'Address': 'address',
  'City': 'city',
  'State': 'state',
  'Zip': 'zip',
  'Primary Contact Name': 'contacts.0.name',
  'Primary Contact Company': 'contacts.0.company',
  'Primary Contact Title': 'contacts.0.title',
  'Primary Contact Email': 'contacts.0.email.0',
};

export async function costarParser(buffer: ArrayBuffer): Promise<ImportSchema[]> {
  const workbook = new exceljs.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
    if(!worksheet) {
        throw new Error("No worksheet found");
    }

  const headers: string[] = [];
  worksheet.getRow(1).eachCell((cell) => {
    headers.push(cell.value as string);
  });

  const data: ImportSchema[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const rowData: Record<string, unknown> = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      if(!header) return;
      const mappedKey = columnMapping[header];
      if (mappedKey) {
        // Simple dot notation handling for nested objects
        const keys = mappedKey.split('.');
        let current: Record<string, unknown> = rowData;
        keys.forEach((key, index) => {
          if (index === keys.length - 1) {
            current[key] = cell.value;
          } else {
            if (!current[key]) {
                if(keys[index+1] === "0"){
                    current[key] = [{}];
                }
                else{
                    current[key] = {};
                }
            }
            if(keys[index+1] === "0"){
                const next = current[key] as Record<string, unknown>[];
                if(next && next[0]) current = next[0];
            }else{
                current = current[key] as Record<string, unknown>;
            }
          }
        });
      }
    });
    data.push(rowData as ImportSchema);
  });

  const validatedData = importBatchSchema.parse(data);
  return validatedData;
}
