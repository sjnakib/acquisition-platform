import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  const { error: jobError } = await supabase.from('import_jobs').insert(importJob);

  if (jobError) {
      console.error(jobError);
      return NextResponse.json({ error: 'Failed to create import job' }, { status: 500 });
  }

  // In a real application, you would trigger a background job (e.g., Supabase Edge Function)
  // to process the import. For this example, we'll just simulate the completion.

  (async () => {
    const importedDeals = deals.map(deal => ({
        ...deal,
        campaign_id: campaignId,
        import_batch: `${new Date().toISOString().slice(0, 10)}_${campaignId}`,
        created_by: user.id,
    }));

    const { error: dealsError } = await supabase.from('deals').insert(importedDeals);

    await supabase.from('import_jobs').update({
        status: dealsError ? 'failed' : 'done',
        inserted: dealsError ? 0 : deals.length,
        error_log: dealsError ? [dealsError.message] : undefined,
    }).eq('id', batchId);

  })();


  return NextResponse.json({ message: 'Import started' });
}
