import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const supabase = createAdminClient()
    const { email, full_name, role, client_org } = await req.json()

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { full_name, role, client_org },
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('Invite error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
