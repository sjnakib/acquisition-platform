// Supabase generated types placeholder
// The database is seeded and migrations are applied
// The Supabase CLI gen types command doesn't output correctly via redirection

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; full_name: string | null; role: string; client_org: string | null; avatar_url: string | null; created_at: string; updated_at: string }
        Insert: { id: string; full_name?: string | null; role?: string; client_org?: string | null; avatar_url?: string | null; created_at?: string; updated_at?: string }
        Update: { full_name?: string | null; role?: string; client_org?: string | null; avatar_url?: string | null; updated_at?: string }
      }
      invitations: {
        Row: { id: string; email: string; role: string; token: string; status: string; project_ids: string[]; invited_by: string; expires_at: string; accepted_at: string | null; accepted_by: string | null; message: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; email: string; role: string; token: string; status?: string; project_ids?: string[]; invited_by: string; expires_at: string; accepted_at?: string | null; accepted_by?: string | null; message?: string | null; created_at?: string; updated_at?: string }
        Update: { status?: string; accepted_at?: string | null; accepted_by?: string | null; updated_at?: string }
      }
      underwriting: {
        Row: {
          id: string; deal_id: string
          underwritability_status: 'go' | 'no_go' | 'maybe' | null
          screened_at: string | null; screened_by: string | null
          asking_price: number | null; price_per_unit: number | null
          population_1mi: number | null; population_growth_pct: number | null
          rent_growth_12mo_pct: number | null; rent_growth_forecast_pct: number | null
          vacancy_rate_pct: number | null; market_price_per_unit: number | null
          delta_pct: number | null; cap_rate: number | null
          purchase_price: number | null; purchase_price_per_unit: number | null
          capex: number | null; capex_per_unit: number | null
          irr_pct: number | null; equity_multiple: number | null
          cash_on_cash_pct: number | null; profit: number | null
          occupancy_pct: number | null
          loi_recommendation: boolean | null
          uw_notes: string | null
          uw_analyst_id: string | null; uw_completion_date: string | null
          reviewer_1_id: string | null; review_1_date: string | null
          reviewer_2_id: string | null; review_2_date: string | null
          created_at: string; updated_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
      loi_records: {
        Row: {
          id: string; deal_id: string
          submitted_at: string | null; offered_price: number | null
          outcome: 'in_progress' | 'deal_reached' | 'fallen_through'
          final_price: number | null; close_date: string | null
          fallen_through_reason: string | null; fallen_through_date: string | null
          loi_email: string | null; last_loi_email_sent_at: string | null
          created_at: string; updated_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
      deals: {
        Row: {
          id: string; project_id: string | null; campaign_id: string | null
          portfolio_id: string | null; is_portfolio: boolean
          import_batch: string | null; stage: string; score: string | null
          is_archived: boolean; archive_reason: string | null
          drive_folder_url: string | null; drive_folder_id: string | null
          drive_file_count: number | null
          outreach_emails: string[]; last_contacted_at: string | null
          last_email_sent_on: string | null; response_type: string | null
          internal_notes: string | null; created_by: string | null
          created_at: string; updated_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
      [key: string]: {
        Row: Record<string, unknown>
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
    }
    Views: Record<string, never>
    Functions: {
      [key: string]: {
        Args: Record<string, unknown>
        Returns: unknown
      }
    }
    Enums: {
      user_role: 'internal' | 'client' | 'admin'
      listing_type: 'on_market' | 'off_market'
      deal_source: 'direct' | 'indirect'
      email_template_key: 'outreach' | 'thank_you' | 'declination'
      deal_stage: 'lead' | 'outreach' | 'response' | 'underwriting' | 'loi' | 'closed' | 'failed' | 'archived'
      deal_score: 'very_good' | 'good' | 'bad' | 'very_bad'
      email_status: 'not_sent' | 'sent' | 'invalid_address' | 'gmail_error' | 'replied'
      response_classification: 'positive' | 'neutral' | 'negative' | 'no_response'
      ca_status: 'not_required' | 'pending' | 'signed' | 'approved'
      underwritability: 'go' | 'no_go' | 'maybe'
      call_status: 'pending' | 'completed' | 'cancelled'
      loi_outcome: 'in_progress' | 'deal_reached' | 'fallen_through'
      field_data_type: 'text' | 'number' | 'integer' | 'date' | 'boolean' | 'url' | 'currency'
      activity_type: 'call' | 'voicemail' | 'note' | 'meeting' | 'other'
      invitation_status: 'pending' | 'accepted' | 'expired' | 'revoked'
    }
    CompositeTypes: Record<string, never>
  }
}
