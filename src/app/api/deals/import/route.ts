import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { costarParser } from '@/lib/import/costar-parser';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const campaignId = formData.get('campaignId') as string;

  if (!file || !campaignId) {
    return NextResponse.json({ error: 'Missing file or campaignId' }, { status: 400 });
  }

  try {
    console.log('[import] Starting file parse, size:', file.size, 'bytes')
    const buffer = await file.arrayBuffer()
    const preview = await costarParser(buffer)
    console.log('[import] Parsed', preview.length, 'rows')

    const batchId = uuidv4()

    return NextResponse.json({ preview, batchId })
  } catch (error) {
    console.error('[import] Parse error:', error)
    const message = error instanceof Error ? error.message : 'Failed to parse file'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
