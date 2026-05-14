import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { costarParser } from '@/lib/import/costar-parser';
import { importBatchSchema } from '@/lib/validations/import.schema';
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
    const buffer = await file.arrayBuffer();
    const preview = await costarParser(buffer);

    const parsedPreview = importBatchSchema.safeParse(preview);
    if (!parsedPreview.success) {
        return NextResponse.json({ error: 'Invalid data format in file', details: parsedPreview.error.flatten() }, { status: 400 });
    }

    const batchId = uuidv4();
    
    // For simplicity, we are not storing the preview data in this example.
    // In a real application, you might want to cache this data in Redis or a temporary table.

    return NextResponse.json({ preview: parsedPreview.data, batchId });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to parse file' }, { status: 500 });
  }
}
