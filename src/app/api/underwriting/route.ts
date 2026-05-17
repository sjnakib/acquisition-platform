import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { deal_id, ...uwData } = body

    // Compute per-unit auto fields from unit_count
    if (uwData.asking_price && deal_id) {
      const { data: deal } = await supabase.from('deals').select('unit_count').eq('id', deal_id).single()
      const units = deal?.unit_count as number | null
      if (units && units > 0) {
        const asking = Number(uwData.asking_price)
        if (!uwData.price_per_unit) uwData.price_per_unit = asking / units
        if (uwData.purchase_price && !uwData.purchase_price_per_unit) {
          uwData.purchase_price_per_unit = Number(uwData.purchase_price) / units
        }
        if (uwData.capex && !uwData.capex_per_unit) {
          uwData.capex_per_unit = Number(uwData.capex) / units
        }
      }
    }

    // Auto-set screened_at/screened_by on first underwritability_status save
    const { data: existing } = await supabase.from('underwriting').select('screened_at').eq('deal_id', deal_id).single()
    if (!existing?.screened_at && uwData.underwritability_status) {
      uwData.screened_at = new Date().toISOString()
      uwData.screened_by = user.id
    }

    const { data, error } = await supabase.from('underwriting').upsert(
      { deal_id, ...uwData },
      { onConflict: 'deal_id' }
    ).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('Underwriting save error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
