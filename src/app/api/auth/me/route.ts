import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, role, client_org, avatar_url, created_at')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // Check if user has connected their Gmail/Google account
    const { data: tokenData, error: tokenError } = await supabase
      .from('google_tokens')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    const gmail_connected = !tokenError && !!tokenData

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      profile,
      gmail_connected,
    })
  } catch (err) {
    console.error('Profile fetch error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { full_name, avatar_url } = body

    if (full_name !== undefined && (typeof full_name !== 'string' || !full_name.trim())) {
      return NextResponse.json({ error: 'Invalid full_name' }, { status: 400 })
    }

    if (avatar_url !== undefined && avatar_url !== null && typeof avatar_url !== 'string') {
      return NextResponse.json({ error: 'Invalid avatar_url' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (full_name !== undefined) updateData.full_name = full_name.trim()
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url !== null ? avatar_url.trim() : null

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Profile update error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
