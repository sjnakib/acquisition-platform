import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/attachments
 * Uploads a file to Supabase Storage (bucket: email-attachments)
 * Body: multipart/form-data with field "file"
 */
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${user.id}/${Date.now()}_${safeName}`

    const { error: uploadError } = await supabase.storage
      .from('email-attachments')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage
      .from('email-attachments')
      .getPublicUrl(storagePath)

    const { data: record, error: insertError } = await supabase
      .from('email_attachments')
      .insert({
        filename: file.name,
        storage_path: storagePath,
        size_bytes: file.size,
        mime_type: file.type,
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json({
      ...record,
      publicUrl: urlData.publicUrl,
    }, { status: 201 })
  } catch (err) {
    console.error('Attachment upload error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
