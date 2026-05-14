import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const { id } = await params
    const supabase = createAdminClient()
    const body = await req.json()

    if (body.role) {
      await (supabase.from('profiles')).update({ role: body.role }).eq('id', id)
      await supabase.auth.admin.updateUserById(id, {
        app_metadata: { role: body.role },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Admin user patch error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const { id } = await params
    const supabase = createAdminClient()
    const { error } = await supabase.auth.admin.deleteUser(id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Admin user delete error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
