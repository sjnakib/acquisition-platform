// Supabase generated types placeholder
// The database is seeded and migrations are applied
// The Supabase CLI gen types command doesn't output correctly via redirection

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
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
      user_role: 'internal' | 'client'
      listing_type: 'on_market' | 'off_market'
      deal_source: 'direct' | 'indirect'
      email_template_key: 'outreach' | 'thank_you' | 'declination'
      deal_stage: 'lead' | 'outreach' | 'response' | 'document_collection' | 'underwritability_review' | 'underwriting' | 'scored' | 'call_scheduled' | 'loi' | 'closed' | 'archived'
      deal_score: 'very_good' | 'good' | 'bad' | 'very_bad'
      property_type: 'multifamily' | 'retail' | 'office' | 'industrial' | 'mixed_use' | 'other'
      building_class: 'A' | 'B' | 'C' | 'D' | 'unclassified'
      email_status: 'not_sent' | 'sent' | 'invalid_address' | 'gmail_error' | 'replied'
      response_classification: 'positive' | 'neutral' | 'negative' | 'no_response'
      ca_status: 'not_required' | 'pending' | 'signed' | 'approved'
      underwritability: 'underwritable' | 'not_underwritable' | 'maybe'
      call_status: 'pending' | 'completed' | 'cancelled'
      loi_outcome: 'in_progress' | 'deal_reached' | 'fallen_through'
    }
    CompositeTypes: Record<string, never>
  }
}