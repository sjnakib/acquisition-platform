'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { ImportPreviewTable } from '@/components/import/ImportPreviewTable';
import { useQuery } from '@tanstack/react-query';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Label } from '@/components/ui/label';

interface ImportStatus {
 status: string;
 inserted: number | null;
 skipped: number | null;
 total_rows: number;
 error_log: string[] | null;
}

const uploadSchema = z.object({
 campaignId: z.string().uuid('Please select a campaign'),
 file: z.instanceof(File, { message: 'Please select an Excel file' }),
});

type UploadSchema = z.infer<typeof uploadSchema>;


export function CoStarImportWizard() {
 const [step, setStep] = useState(1);
 const [previewData, setPreviewData] = useState<Record<string, unknown>[] | null>(null);
 const [batchId, setBatchId] = useState<string | null>(null);
 const [serverError, setServerError] = useState<string | null>(null);
 const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
 const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

 // Poll import status on step 3
 useEffect(() => {
 if (step !== 3 || !batchId) return;
 let active = true;

 const poll = async () => {
 try {
 const res = await fetch(`/api/deals/import/${batchId}/status`);
 if (!res.ok) return;
 const data: ImportStatus = await res.json();
 if (!active) return;
 setImportStatus(data);
 if (data.status === 'done' || data.status === 'failed') {
 if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
 }
 } catch { /* retry on next tick */ }
 };

 poll();
 pollRef.current = setInterval(poll, 1500);
 return () => { active = false; if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
 }, [step, batchId]);

 const {
 data: campaigns,
 isLoading: campaignsLoading,
 error: campaignsError,
 } = useQuery({
 queryKey: ['campaigns'],
 queryFn: async () => {
 const res = await fetch('/api/campaigns');
 if (!res.ok) throw new Error('Failed to fetch campaigns');
 return res.json() as Promise<Array<{ id: string; name: string; market: string }>>;
 },
 });

 const {
 control,
 handleSubmit,
 setValue,
 getValues,
 formState: { errors, isSubmitting },
 } = useForm<UploadSchema>({
 resolver: zodResolver(uploadSchema),
 });

 const onUploadSubmit = async (data: UploadSchema) => {
 setServerError(null);
 const formData = new FormData();
 formData.append('file', data.file);
 formData.append('campaignId', data.campaignId);

 try {
 const res = await fetch('/api/deals/import', {
 method: 'POST',
 body: formData,
 });

 if (res.ok) {
 const result = await res.json();
 setPreviewData(result.preview);
 setBatchId(result.batchId);
 setStep(2);
 } else {
 const err = await res.json().catch(() => ({ error: 'Upload failed' }));
 setServerError(err.error || 'Upload failed');
 }
 } catch {
 setServerError('Network error — please try again');
 }
 };

 const onConfirmImport = async () => {
 if (!batchId) return;

 const res = await fetch(`/api/deals/import/${batchId}/confirm`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 campaignId: getValues('campaignId'),
 deals: previewData,
 }),
 });

 if (res.ok) {
 setStep(3);
 } else {
 const err = await res.json().catch(() => ({ error: 'Import failed' }));
 setServerError(err.error || 'Import failed');
 }
 };

 return (
 <Card>
 <CardHeader>
 <CardTitle>Step {step} of 3</CardTitle>
 </CardHeader>
 <CardContent>
 {step === 1 && (
 <form onSubmit={handleSubmit(onUploadSubmit)} className="space-y-4">
 <div>
 <Label htmlFor="campaignId">Campaign</Label>
 <Controller
 name="campaignId"
 control={control}
 render={({ field }) => (
 <Select onValueChange={field.onChange} value={field.value}>
 <SelectTrigger id="campaignId">
 <SelectValue placeholder="Select a campaign" />
 </SelectTrigger>
 <SelectContent>
 {campaignsLoading ? (
 <SelectItem value="loading" disabled>
 Loading campaigns...
 </SelectItem>
 ) : campaignsError ? (
 <SelectItem value="error" disabled>
 Failed to load campaigns
 </SelectItem>
 ) : !campaigns || campaigns.length === 0 ? (
 <SelectItem value="empty" disabled>
 No campaigns — create one first
 </SelectItem>
 ) : (
 campaigns.map((campaign) => (
 <SelectItem key={campaign.id} value={campaign.id}>
 {campaign.name} — {campaign.market}
 </SelectItem>
 ))
 )}
 </SelectContent>
 </Select>
 )}
 />
 {errors.campaignId && <p className="text-red-500 text-sm mt-1">{errors.campaignId.message}</p>}
 </div>

 <div>
 <Label htmlFor="file">Excel File</Label>
 <Input
 id="file"
 type="file"
 accept=".xlsx,.xls"
 onChange={(e) => {
 const file = e.target.files?.[0];
 if (file) {
 setValue('file', file, { shouldValidate: true });
 }
 }}
 />
 {errors.file && <p className="text-red-500 text-sm mt-1">{errors.file.message}</p>}
 </div>

 <Button type="submit" disabled={isSubmitting}>
 {isSubmitting ? 'Uploading...' : 'Upload and Preview'}
 </Button>
 {serverError && (
 <p className="text-red-500 text-sm">{serverError}</p>
 )}
 </form>
 )}

 {step === 2 && previewData && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="font-bold text-lg">Preview Import</h3>
 <p className="text-sm ">
 {previewData.length.toLocaleString()} records found. Review the data before confirming.
 </p>
 </div>
 <div className="flex gap-2">
 <Button variant="outline" onClick={() => setStep(1)}>
 Back
 </Button>
 <Button onClick={onConfirmImport}>Confirm Import</Button>
 </div>
 </div>
 <ImportPreviewTable data={previewData} />
 {serverError && (
 <p className="text-red-500 text-sm">{serverError}</p>
 )}
 <div className="flex justify-end gap-2">
 <Button variant="outline" onClick={() => setStep(1)}>
 Back
 </Button>
 <Button onClick={onConfirmImport}>Confirm Import</Button>
 </div>
 </div>
 )}

 {step === 3 && (
 <div className="space-y-4">
 {!importStatus || importStatus.status === 'running' ? (
 <div className="flex flex-col items-center gap-4 py-8">
 <LoadingSpinner />
 <div className="text-center">
 <h3 className="font-bold text-lg">Importing...</h3>
 <p className="text-sm ">
 Processing {previewData?.length.toLocaleString() ?? '?'} deals. This may take a moment.
 </p>
 </div>
 </div>
 ) : importStatus.status === 'done' ? (
 <div className="flex flex-col items-center gap-2 py-8">
 <div className="text-green-600 text-4xl">&#10003;</div>
 <h3 className="font-bold text-lg">Import Complete</h3>
 <p className="text-sm ">
 {importStatus.inserted?.toLocaleString() ?? 0} of {importStatus.total_rows.toLocaleString()} deals imported successfully.
 {importStatus.skipped ? ` (${importStatus.skipped.toLocaleString()} duplicates skipped)` : ''}
 </p>
 <Button variant="outline" className="mt-4" onClick={() => { setStep(1); setPreviewData(null); setBatchId(null); setImportStatus(null); }}>
 Start New Import
 </Button>
 </div>
 ) : (
 <div className="flex flex-col items-center gap-2 py-8">
 <div className="text-red-600 text-4xl">&#10007;</div>
 <h3 className="font-bold text-lg">Import Failed</h3>
 <p className="text-sm ">
 {importStatus.inserted?.toLocaleString() ?? 0} of {importStatus.total_rows.toLocaleString()} deals imported before failure.
 {importStatus.skipped ? ` (${importStatus.skipped.toLocaleString()} duplicates skipped)` : ''}
 </p>
 {importStatus.error_log && importStatus.error_log.length > 0 && (
 <pre className="mt-2 max-h-32 overflow-auto rounded bg-red-50 p-2 text-xs text-red-800 w-full">
 {importStatus.error_log.join('\n')}
 </pre>
 )}
 <Button variant="outline" className="mt-4" onClick={() => setStep(1)}>
 Back to Upload
 </Button>
 </div>
 )}
 </div>
 )}
 </CardContent>
 </Card>
 );
}
