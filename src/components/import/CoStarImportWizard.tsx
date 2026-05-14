'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/PageHeader';

const uploadSchema = z.object({
  campaignId: z.string().uuid(),
  file: z.instanceof(File),
});

type UploadSchema = z.infer<typeof uploadSchema>;

// Mocked campaigns for now
const useCampaigns = () => {
    return useQuery({
        queryKey: ['campaigns'],
        queryFn: async () => {
            return [
                { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', name: 'Campaign A' },
                { id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', name: 'Campaign B' },
            ];
        }
    });
}


export function CoStarImportWizard() {
  const [step, setStep] = useState(1);
  const [previewData, setPreviewData] = useState<Record<string, unknown>[] | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);

  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UploadSchema>({
    resolver: zodResolver(uploadSchema),
  });

  const onUploadSubmit = async (data: UploadSchema) => {
    const formData = new FormData();
    formData.append('file', data.file);
    formData.append('campaignId', data.campaignId);

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
      // Handle error
      console.error('Upload failed');
    }
  };

  const onConfirmImport = async () => {
    if (!batchId) return;

    const res = await fetch(`/api/deals/import/${batchId}/confirm`, {
      method: 'POST',
    });

    if (res.ok) {
      setStep(3);
    } else {
      // Handle error
      console.error('Confirmation failed');
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
              <label htmlFor="campaignId">Campaign</label>
              <Select {...register('campaignId')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a campaign" />
                </SelectTrigger>
                <SelectContent>
                  {campaignsLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading...
                    </SelectItem>
                  ) : (
                    campaigns?.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {errors.campaignId && <p className="text-red-500">{errors.campaignId.message}</p>}
            </div>

            <div>
              <label htmlFor="file">Excel File</label>
              <Input id="file" type="file" {...register('file')} />
              {errors.file && <p className="text-red-500">{errors.file.message as string}</p>}
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Uploading...' : 'Upload and Preview'}
            </Button>
          </form>
        )}

        {step === 2 && previewData && (
          <div className="space-y-4">
            <h3 className="font-bold">Preview</h3>
            <p>
              Found {previewData.length} records. Please review the data before importing.
            </p>
            {/* Display a table of preview data here */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={onConfirmImport}>Confirm Import</Button>
            </div>
          </div>
        )}

        {step === 3 && (
            <div>
                <PageHeader title="Import Started" description="Your import is being processed in the background. You can check the status on the Campaigns page."/>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
