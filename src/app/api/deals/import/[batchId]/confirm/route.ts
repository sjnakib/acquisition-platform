import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = createAdminClient();

  const { batchId } = await params;
  const { campaignId, deals } = await req.json();

  if (!campaignId || !deals || !Array.isArray(deals)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const importJob = {
    id: batchId,
    campaign_id: campaignId,
    user_id: user.id,
    total_rows: deals.length,
    status: 'running',
  };

  const { error: jobError } = await adminClient.from('import_jobs').insert(importJob);

  if (jobError) {
      console.error(jobError);
      return NextResponse.json({ error: 'Failed to create import job' }, { status: 500 });
  }

  // In a real application, you would trigger a background job (e.g., Supabase Edge Function)
  // to process the import. For this example, we'll just simulate the completion.

  (async () => {
    try {
      // Clean + deduplicate within batch (keep first occurrence by property_id)
      const seen = new Set<string>();
      let skippedDupes = 0;
      const cleanedDeals: Record<string, unknown>[] = [];

      for (const deal of deals) {
        const row = deal as Record<string, unknown>;
        const cleaned: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
          if (v !== undefined && v !== null) cleaned[k] = v;
        }
        const pid = cleaned.property_id as string | undefined;
        if (pid) {
          if (seen.has(pid)) { skippedDupes++; continue; }
          seen.add(pid);
        }
        cleanedDeals.push({
          ...cleaned,
          campaign_id: campaignId,
          import_batch: `${new Date().toISOString().slice(0, 10)}_${campaignId}`,
          created_by: user.id,
        });
      }

      // Check for existing property_ids in this campaign to avoid unique constraint
      const pids = cleanedDeals
        .map((d) => d.property_id as string | undefined)
        .filter((p): p is string => !!p);

      if (pids.length > 0) {
        // Query existing IDs in chunks (in filter has ~1000 item limit)
        const existingSet = new Set<string>();
        const CHUNK = 500;
        for (let i = 0; i < pids.length; i += CHUNK) {
          const pidChunk = pids.slice(i, i + CHUNK);
          const { data: batch } = await adminClient
            .from('deals')
            .select('property_id')
            .eq('campaign_id', campaignId)
            .in('property_id', pidChunk);
          if (batch) {
            for (const d of batch) {
              existingSet.add((d as Record<string, unknown>).property_id as string);
            }
          }
        }

        if (existingSet.size > 0) {
          const filtered = cleanedDeals.filter((d) => {
            const pid = d.property_id as string | undefined;
            if (pid && existingSet.has(pid)) { skippedDupes++; return false; }
            return true;
          });
          cleanedDeals.length = 0;
          cleanedDeals.push(...filtered);
        }
      }

      let inserted = 0;
      if (cleanedDeals.length > 0) {
        // Insert in batches of 1000 to avoid oversized requests
        const BATCH = 1000;
        for (let i = 0; i < cleanedDeals.length; i += BATCH) {
          const chunk = cleanedDeals.slice(i, i + BATCH);
          const { error: dealsError } = await adminClient.from('deals').insert(chunk);
          if (dealsError) {
            throw new Error(dealsError.message);
          }
          inserted += chunk.length;
        }
      }

      await adminClient.from('import_jobs').update({
        status: 'done',
        inserted,
        skipped: skippedDupes,
        error_log: skippedDupes > 0 ? [`${skippedDupes} duplicate property_ids skipped`] : undefined,
      }).eq('id', batchId);
    } catch (err) {
      console.error('[import] Background insert error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      await adminClient.from('import_jobs').update({
        status: 'failed',
        inserted: 0,
        error_log: [message],
      }).eq('id', batchId);
    }
  })();


  return NextResponse.json({ message: 'Import started' });
}
