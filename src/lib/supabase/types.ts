Initialising login role...
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ca_credentials: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          password_encrypted: string | null
          platform: string
          username: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          password_encrypted?: string | null
          platform: string
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          password_encrypted?: string | null
          platform?: string
          username?: string | null
        }
        Relationships: []
      }
      call_briefs: {
        Row: {
          call_status: Database["public"]["Enums"]["call_status"]
          client_notes: string | null
          completed_at: string | null
          deal_id: string
          flagged_at: string
          flagged_by: string | null
          id: string
          published: boolean
          published_at: string | null
          summary_text: string | null
          updated_at: string
        }
        Insert: {
          call_status?: Database["public"]["Enums"]["call_status"]
          client_notes?: string | null
          completed_at?: string | null
          deal_id: string
          flagged_at?: string
          flagged_by?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          summary_text?: string | null
          updated_at?: string
        }
        Update: {
          call_status?: Database["public"]["Enums"]["call_status"]
          client_notes?: string | null
          completed_at?: string | null
          deal_id?: string
          flagged_at?: string
          flagged_by?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          summary_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_briefs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_briefs_flagged_by_fkey"
            columns: ["flagged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          email_subject_template: string | null
          email_template:
            | Database["public"]["Enums"]["email_template_key"]
            | null
          id: string
          is_active: boolean
          listing_type: Database["public"]["Enums"]["listing_type"] | null
          market: string
          name: string
          target_loi_count: number | null
          target_response_rate_pct: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email_subject_template?: string | null
          email_template?:
            | Database["public"]["Enums"]["email_template_key"]
            | null
          id?: string
          is_active?: boolean
          listing_type?: Database["public"]["Enums"]["listing_type"] | null
          market: string
          name: string
          target_loi_count?: number | null
          target_response_rate_pct?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email_subject_template?: string | null
          email_template?:
            | Database["public"]["Enums"]["email_template_key"]
            | null
          id?: string
          is_active?: boolean
          listing_type?: Database["public"]["Enums"]["listing_type"] | null
          market?: string
          name?: string
          target_loi_count?: number | null
          target_response_rate_pct?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company: string | null
          created_at: string
          deal_id: string
          email: string[] | null
          id: string
          is_primary: boolean
          name: string | null
          phone_cell: string | null
          phone_office: string | null
          title: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          deal_id: string
          email?: string[] | null
          id?: string
          is_primary?: boolean
          name?: string | null
          phone_cell?: string | null
          phone_office?: string | null
          title?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          deal_id?: string
          email?: string[] | null
          id?: string
          is_primary?: boolean
          name?: string | null
          phone_cell?: string | null
          phone_office?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          address: string | null
          archive_reason: string | null
          building_class: Database["public"]["Enums"]["building_class"] | null
          campaign_id: string | null
          city: string | null
          created_at: string
          created_by: string | null
          deal_name: string | null
          drive_folder_url: string | null
          id: string
          import_batch: string | null
          internal_notes: string | null
          is_archived: boolean
          listing_type: Database["public"]["Enums"]["listing_type"] | null
          property_id: string | null
          property_link: string | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          score: Database["public"]["Enums"]["deal_score"] | null
          source: Database["public"]["Enums"]["deal_source"]
          stage: Database["public"]["Enums"]["deal_stage"]
          state: string | null
          unit_count: number | null
          updated_at: string
          year_built: number | null
          year_renovated: number | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          archive_reason?: string | null
          building_class?: Database["public"]["Enums"]["building_class"] | null
          campaign_id?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          deal_name?: string | null
          drive_folder_url?: string | null
          id?: string
          import_batch?: string | null
          internal_notes?: string | null
          is_archived?: boolean
          listing_type?: Database["public"]["Enums"]["listing_type"] | null
          property_id?: string | null
          property_link?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          score?: Database["public"]["Enums"]["deal_score"] | null
          source?: Database["public"]["Enums"]["deal_source"]
          stage?: Database["public"]["Enums"]["deal_stage"]
          state?: string | null
          unit_count?: number | null
          updated_at?: string
          year_built?: number | null
          year_renovated?: number | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          archive_reason?: string | null
          building_class?: Database["public"]["Enums"]["building_class"] | null
          campaign_id?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          deal_name?: string | null
          drive_folder_url?: string | null
          id?: string
          import_batch?: string | null
          internal_notes?: string | null
          is_archived?: boolean
          listing_type?: Database["public"]["Enums"]["listing_type"] | null
          property_id?: string | null
          property_link?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          score?: Database["public"]["Enums"]["deal_score"] | null
          source?: Database["public"]["Enums"]["deal_source"]
          stage?: Database["public"]["Enums"]["deal_stage"]
          state?: string | null
          unit_count?: number | null
          updated_at?: string
          year_built?: number | null
          year_renovated?: number | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_checklist: {
        Row: {
          ca_credential_id: string | null
          ca_platform: string | null
          ca_status: Database["public"]["Enums"]["ca_status"]
          capex_collected: boolean | null
          deal_id: string
          id: string
          market_report_1: boolean | null
          market_report_2: boolean | null
          market_report_3: boolean | null
          market_report_4: boolean | null
          om_collected: boolean
          pl_collected: boolean
          pl_period: string | null
          rent_roll_as_of: string | null
          rent_roll_collected: boolean
          tax_bill_collected: boolean | null
          updated_at: string
        }
        Insert: {
          ca_credential_id?: string | null
          ca_platform?: string | null
          ca_status?: Database["public"]["Enums"]["ca_status"]
          capex_collected?: boolean | null
          deal_id: string
          id?: string
          market_report_1?: boolean | null
          market_report_2?: boolean | null
          market_report_3?: boolean | null
          market_report_4?: boolean | null
          om_collected?: boolean
          pl_collected?: boolean
          pl_period?: string | null
          rent_roll_as_of?: string | null
          rent_roll_collected?: boolean
          tax_bill_collected?: boolean | null
          updated_at?: string
        }
        Update: {
          ca_credential_id?: string | null
          ca_platform?: string | null
          ca_status?: Database["public"]["Enums"]["ca_status"]
          capex_collected?: boolean | null
          deal_id?: string
          id?: string
          market_report_1?: boolean | null
          market_report_2?: boolean | null
          market_report_3?: boolean | null
          market_report_4?: boolean | null
          om_collected?: boolean
          pl_collected?: boolean
          pl_period?: string | null
          rent_roll_as_of?: string | null
          rent_roll_collected?: boolean
          tax_bill_collected?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_checklist_ca_credential_id_fkey"
            columns: ["ca_credential_id"]
            isOneToOne: false
            referencedRelation: "ca_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_checklist_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outreach: {
        Row: {
          contact_id: string | null
          conversation_log: string | null
          created_at: string
          deal_id: string
          declination_sent: boolean
          declination_sent_at: string | null
          error_message: string | null
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          responded_at: string | null
          response_classification:
            | Database["public"]["Enums"]["response_classification"]
            | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          subject: string | null
          template_used:
            | Database["public"]["Enums"]["email_template_key"]
            | null
          thank_you_sent: boolean
          thank_you_sent_at: string | null
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          conversation_log?: string | null
          created_at?: string
          deal_id: string
          declination_sent?: boolean
          declination_sent_at?: string | null
          error_message?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          responded_at?: string | null
          response_classification?:
            | Database["public"]["Enums"]["response_classification"]
            | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string | null
          template_used?:
            | Database["public"]["Enums"]["email_template_key"]
            | null
          thank_you_sent?: boolean
          thank_you_sent_at?: string | null
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          conversation_log?: string | null
          created_at?: string
          deal_id?: string
          declination_sent?: boolean
          declination_sent_at?: string | null
          error_message?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          responded_at?: string | null
          response_classification?:
            | Database["public"]["Enums"]["response_classification"]
            | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string | null
          template_used?:
            | Database["public"]["Enums"]["email_template_key"]
            | null
          thank_you_sent?: boolean
          thank_you_sent_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_outreach_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outreach_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      google_tokens: {
        Row: {
          access_token: string
          created_at: string
          expiry: string | null
          id: string
          last_history_id: string | null
          refresh_token: string | null
          scopes: string[] | null
          token_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expiry?: string | null
          id?: string
          last_history_id?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          token_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expiry?: string | null
          id?: string
          last_history_id?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          token_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          campaign_id: string | null
          created_at: string
          error_log: string[] | null
          id: string
          inserted: number
          skipped: number
          status: string
          total_rows: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          error_log?: string[] | null
          id?: string
          inserted?: number
          skipped?: number
          status?: string
          total_rows?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          error_log?: string[] | null
          id?: string
          inserted?: number
          skipped?: number
          status?: string
          total_rows?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      loi_records: {
        Row: {
          close_date: string | null
          created_at: string
          deal_id: string
          fallen_through_date: string | null
          fallen_through_reason: string | null
          final_price: number | null
          id: string
          offered_price: number | null
          outcome: Database["public"]["Enums"]["loi_outcome"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          close_date?: string | null
          created_at?: string
          deal_id: string
          fallen_through_date?: string | null
          fallen_through_reason?: string | null
          final_price?: number | null
          id?: string
          offered_price?: number | null
          outcome?: Database["public"]["Enums"]["loi_outcome"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          close_date?: string | null
          created_at?: string
          deal_id?: string
          fallen_through_date?: string | null
          fallen_through_reason?: string | null
          final_price?: number | null
          id?: string
          offered_price?: number | null
          outcome?: Database["public"]["Enums"]["loi_outcome"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loi_records_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      loi_rounds: {
        Row: {
          created_at: string
          id: string
          loi_id: string
          notes: string | null
          party: string | null
          price: number | null
          round_date: string | null
          round_num: number
        }
        Insert: {
          created_at?: string
          id?: string
          loi_id: string
          notes?: string | null
          party?: string | null
          price?: number | null
          round_date?: string | null
          round_num: number
        }
        Update: {
          created_at?: string
          id?: string
          loi_id?: string
          notes?: string | null
          party?: string | null
          price?: number | null
          round_date?: string | null
          round_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "loi_rounds_loi_id_fkey"
            columns: ["loi_id"]
            isOneToOne: false
            referencedRelation: "loi_records"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          client_org: string | null
          created_at: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          client_org?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          client_org?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      underwriting: {
        Row: {
          asking_price: number | null
          asking_price_per_unit: number | null
          cap_rate: number | null
          capex_estimate: number | null
          cash_on_cash_pct: number | null
          created_at: string
          deal_id: string
          equity_multiple: number | null
          id: string
          irr_pct: number | null
          market_delta_pct: number | null
          market_price_per_unit: number | null
          occupancy_pct: number | null
          population_1mi: number | null
          population_growth_pct: number | null
          projected_profit: number | null
          purchase_price: number | null
          purchase_price_per_unit: number | null
          rent_comps_available: boolean | null
          rent_growth_fwd_pct: number | null
          rent_growth_t12_pct: number | null
          sale_comps_available: boolean | null
          screened_at: string | null
          screened_by: string | null
          underwritability:
            | Database["public"]["Enums"]["underwritability"]
            | null
          updated_at: string
          uw_notes: string | null
          vacancy_rate_pct: number | null
        }
        Insert: {
          asking_price?: number | null
          asking_price_per_unit?: number | null
          cap_rate?: number | null
          capex_estimate?: number | null
          cash_on_cash_pct?: number | null
          created_at?: string
          deal_id: string
          equity_multiple?: number | null
          id?: string
          irr_pct?: number | null
          market_delta_pct?: number | null
          market_price_per_unit?: number | null
          occupancy_pct?: number | null
          population_1mi?: number | null
          population_growth_pct?: number | null
          projected_profit?: number | null
          purchase_price?: number | null
          purchase_price_per_unit?: number | null
          rent_comps_available?: boolean | null
          rent_growth_fwd_pct?: number | null
          rent_growth_t12_pct?: number | null
          sale_comps_available?: boolean | null
          screened_at?: string | null
          screened_by?: string | null
          underwritability?:
            | Database["public"]["Enums"]["underwritability"]
            | null
          updated_at?: string
          uw_notes?: string | null
          vacancy_rate_pct?: number | null
        }
        Update: {
          asking_price?: number | null
          asking_price_per_unit?: number | null
          cap_rate?: number | null
          capex_estimate?: number | null
          cash_on_cash_pct?: number | null
          created_at?: string
          deal_id?: string
          equity_multiple?: number | null
          id?: string
          irr_pct?: number | null
          market_delta_pct?: number | null
          market_price_per_unit?: number | null
          occupancy_pct?: number | null
          population_1mi?: number | null
          population_growth_pct?: number | null
          projected_profit?: number | null
          purchase_price?: number | null
          purchase_price_per_unit?: number | null
          rent_comps_available?: boolean | null
          rent_growth_fwd_pct?: number | null
          rent_growth_t12_pct?: number | null
          sale_comps_available?: boolean | null
          screened_at?: string | null
          screened_by?: string | null
          underwritability?:
            | Database["public"]["Enums"]["underwritability"]
            | null
          updated_at?: string
          uw_notes?: string | null
          vacancy_rate_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "underwriting_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "underwriting_screened_by_fkey"
            columns: ["screened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_pipeline_summary: {
        Args: never
        Returns: {
          campaign_name: string
          closed_count: number
          emails_sent: number
          leads: number
          loi_count: number
          market: string
          responses_positive: number
          scored_good: number
          underwritten: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      store_ca_credential: {
        Args: {
          p_encryption_key: string
          p_password: string
          p_platform: string
          p_username: string
        }
        Returns: string
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      building_class: "A" | "B" | "C" | "D" | "unclassified"
      ca_status: "not_required" | "pending" | "signed" | "approved"
      call_status: "pending" | "completed" | "cancelled"
      deal_score: "very_good" | "good" | "bad" | "very_bad"
      deal_source: "direct" | "indirect"
      deal_stage:
        | "lead"
        | "outreach"
        | "response"
        | "document_collection"
        | "underwritability_review"
        | "underwriting"
        | "scored"
        | "call_scheduled"
        | "loi"
        | "closed"
        | "archived"
      email_status:
        | "not_sent"
        | "sent"
        | "invalid_address"
        | "gmail_error"
        | "replied"
      email_template_key: "outreach" | "thank_you" | "declination"
      listing_type: "on_market" | "off_market"
      loi_outcome: "in_progress" | "deal_reached" | "fallen_through"
      property_type:
        | "multifamily"
        | "retail"
        | "office"
        | "industrial"
        | "mixed_use"
        | "other"
      response_classification:
        | "positive"
        | "neutral"
        | "negative"
        | "no_response"
      underwritability: "underwritable" | "not_underwritable" | "maybe"
      user_role: "internal" | "client"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      building_class: ["A", "B", "C", "D", "unclassified"],
      ca_status: ["not_required", "pending", "signed", "approved"],
      call_status: ["pending", "completed", "cancelled"],
      deal_score: ["very_good", "good", "bad", "very_bad"],
      deal_source: ["direct", "indirect"],
      deal_stage: [
        "lead",
        "outreach",
        "response",
        "document_collection",
        "underwritability_review",
        "underwriting",
        "scored",
        "call_scheduled",
        "loi",
        "closed",
        "archived",
      ],
      email_status: [
        "not_sent",
        "sent",
        "invalid_address",
        "gmail_error",
        "replied",
      ],
      email_template_key: ["outreach", "thank_you", "declination"],
      listing_type: ["on_market", "off_market"],
      loi_outcome: ["in_progress", "deal_reached", "fallen_through"],
      property_type: [
        "multifamily",
        "retail",
        "office",
        "industrial",
        "mixed_use",
        "other",
      ],
      response_classification: [
        "positive",
        "neutral",
        "negative",
        "no_response",
      ],
      underwritability: ["underwritable", "not_underwritable", "maybe"],
      user_role: ["internal", "client"],
    },
  },
} as const
