import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const allowedFields: Record<string, unknown> = {}
    if (body.response_classification) allowedFields.response_classification = body.response_classification
    if (body.thank_you_sent === true) {
      allowedFields.thank_you_sent = true
      allowedFields.thank_you_sent_at = new Date().toISOString()
    }
    if (body.declination_sent === true) {
      allowedFields.declination_sent = true
      allowedFields.declination_sent_at = new Date().toISOString()
    }
    if (typeof body.conversation_log === 'string') {
      allowedFields.conversation_log = body.conversation_log.slice(0, 5000)
    }

    const { data, error } = await supabase.from('email_outreach').update(allowedFields).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('Email patch error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
