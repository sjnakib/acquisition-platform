'use client';

import { useMemo } from 'react';
import { DataGrid, type ColumnDef } from '@/components/shared/DataGrid';

type PreviewRow = Record<string, unknown>;

const COLUMN_DEFS: { key: string; header: string }[] = [
 { key: 'property_id', header: 'Property ID' },
 { key: 'deal_name', header: 'Deal Name' },
 { key: 'address', header: 'Address' },
 { key: 'city', header: 'City' },
 { key: 'state', header: 'State' },
 { key: 'zip', header: 'ZIP' },
 { key: 'property_type', header: 'Property Type' },
 { key: 'building_class', header: 'Class' },
 { key: 'year_built', header: 'Year Built' },
 { key: 'year_renovated', header: 'Year Renov.' },
 { key: 'unit_count', header: 'Units' },
 { key: 'property_link', header: 'Property Link' },
 { key: 'contact_name', header: 'Contact Name' },
 { key: 'contact_company', header: 'Contact Company' },
 { key: 'contact_title', header: 'Contact Title' },
 { key: 'contact_email', header: 'Contact Email' },
];

function extractContact(row: PreviewRow) {
 const contacts = row.contacts as Array<Record<string, unknown>> | undefined;
 const first = contacts?.[0];
 return {
 contact_name: (first?.name as string) ?? '',
 contact_company: (first?.company as string) ?? '',
 contact_title: (first?.title as string) ?? '',
 contact_email: Array.isArray(first?.email) ? (first.email[0] as string ?? '') : '',
 };
}

interface ImportPreviewTableProps {
 data: PreviewRow[];
}

export function ImportPreviewTable({ data }: ImportPreviewTableProps) {
 const rows = useMemo(() => {
 return data.map((row) => {
 const contact = extractContact(row);
 return { ...row, ...contact };
 });
 }, [data]);

 // Only show columns that have at least one non-empty value
 const columns: ColumnDef<PreviewRow>[] = useMemo(() => {
 return COLUMN_DEFS
 .filter((col) =>
 rows.some((row) => {
 const v = (row as Record<string, unknown>)[col.key];
 return v != null && String(v).trim() !== '';
 })
 )
 .map((col) => ({
 key: col.key,
 header: col.header,
 sortable: true,
 minWidth: 80,
 maxWidth: 300,
 align: (col.key === 'unit_count' || col.key === 'year_built' || col.key === 'year_renovated') ? 'right' as const : 'left' as const,
 }));
 }, [rows]);

 return (
 <DataGrid
 columns={columns}
 data={rows}
 rowKey={(_, i) => String(i)}
 emptyMessage="No data to preview"
 maxHeight={480}
 />
 );
}
