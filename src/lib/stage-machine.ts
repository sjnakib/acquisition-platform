export const DEAL_STAGES = [
  'lead', 'outreach', 'response', 'underwriting',
  'loi', 'closed', 'failed', 'archived',
] as const
export type DealStage = (typeof DEAL_STAGES)[number]

const FORWARD: Record<DealStage, DealStage | null> = {
  lead: 'outreach',
  outreach: 'response',
  response: 'underwriting',
  underwriting: 'loi',
  loi: 'closed',
  closed: null,
  failed: null,
  archived: null,
}

export function nextStage(current: DealStage): DealStage | null {
  return FORWARD[current]
}

export function canTransition(from: DealStage, to: DealStage): { ok: boolean; reason?: string } {
  if (from === to) return { ok: true }

  if (to === 'failed' && from !== 'loi') {
    return { ok: false, reason: "'failed' is only valid after the LOI stage. Use 'archived' instead." }
  }

  if (to === 'archived' && (from === 'loi' || from === 'closed' || from === 'failed')) {
    return { ok: false, reason: "Deals at or past the LOI stage cannot be archived; set 'closed' or 'failed'." }
  }

  return { ok: true }
}
