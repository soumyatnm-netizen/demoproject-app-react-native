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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      appetite_match_results: {
        Row: {
          capacity_fit_diff: number | null
          carrier_id: string | null
          client_document_id: string | null
          confidence_score: number
          coverage_fit: string | null
          created_at: string | null
          exclusions_hit: string[] | null
          explanation: string | null
          id: string
          industry_fit: string | null
          jurisdiction_fit: boolean | null
          matched_at: string | null
          primary_reasons: string[] | null
          score_breakdown: Json | null
        }
        Insert: {
          capacity_fit_diff?: number | null
          carrier_id?: string | null
          client_document_id?: string | null
          confidence_score: number
          coverage_fit?: string | null
          created_at?: string | null
          exclusions_hit?: string[] | null
          explanation?: string | null
          id?: string
          industry_fit?: string | null
          jurisdiction_fit?: boolean | null
          matched_at?: string | null
          primary_reasons?: string[] | null
          score_breakdown?: Json | null
        }
        Update: {
          capacity_fit_diff?: number | null
          carrier_id?: string | null
          client_document_id?: string | null
          confidence_score?: number
          coverage_fit?: string | null
          created_at?: string | null
          exclusions_hit?: string[] | null
          explanation?: string | null
          id?: string
          industry_fit?: string | null
          jurisdiction_fit?: boolean | null
          matched_at?: string | null
          primary_reasons?: string[] | null
          score_breakdown?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "appetite_match_results_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "underwriter_appetites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appetite_match_results_client_document_id_fkey"
            columns: ["client_document_id"]
            isOneToOne: false
            referencedRelation: "structured_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_companies: {
        Row: {
          address: string | null
          city: string | null
          company_code: string | null
          company_code_expires_at: string | null
          country: string | null
          created_at: string
          domain: string | null
          id: string
          logo_url: string | null
          max_users: number | null
          name: string
          phone: string | null
          subscription_tier: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_code?: string | null
          company_code_expires_at?: string | null
          country?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          logo_url?: string | null
          max_users?: number | null
          name: string
          phone?: string | null
          subscription_tier?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_code?: string | null
          company_code_expires_at?: string | null
          country?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          logo_url?: string | null
          max_users?: number | null
          name?: string
          phone?: string | null
          subscription_tier?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      client_reports: {
        Row: {
          activity_split: Json | null
          broker_company_name: string | null
          broker_logo_url: string | null
          claims_free: boolean | null
          client_name: string
          comparison_id: string | null
          created_at: string
          current_broker: string | null
          current_carrier: string | null
          current_premium_total: number | null
          id: string
          key_changes: Json | null
          pdf_storage_path: string | null
          recent_claims_details: string | null
          recommendations: string[] | null
          renewal_date: string | null
          report_data: Json
          report_status: string | null
          report_title: string
          revenue_split_geography: Json | null
          sells_in_us: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_split?: Json | null
          broker_company_name?: string | null
          broker_logo_url?: string | null
          claims_free?: boolean | null
          client_name: string
          comparison_id?: string | null
          created_at?: string
          current_broker?: string | null
          current_carrier?: string | null
          current_premium_total?: number | null
          id?: string
          key_changes?: Json | null
          pdf_storage_path?: string | null
          recent_claims_details?: string | null
          recommendations?: string[] | null
          renewal_date?: string | null
          report_data: Json
          report_status?: string | null
          report_title: string
          revenue_split_geography?: Json | null
          sells_in_us?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_split?: Json | null
          broker_company_name?: string | null
          broker_logo_url?: string | null
          claims_free?: boolean | null
          client_name?: string
          comparison_id?: string | null
          created_at?: string
          current_broker?: string | null
          current_carrier?: string | null
          current_premium_total?: number | null
          id?: string
          key_changes?: Json | null
          pdf_storage_path?: string | null
          recent_claims_details?: string | null
          recommendations?: string[] | null
          renewal_date?: string | null
          report_data?: Json
          report_status?: string | null
          report_title?: string
          revenue_split_geography?: Json | null
          sells_in_us?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_reports_comparison_id_fkey"
            columns: ["comparison_id"]
            isOneToOne: false
            referencedRelation: "comparisons"
            referencedColumns: ["id"]
          },
        ]
      }
      company_invites: {
        Row: {
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invite_code: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"] | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invite_code: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"] | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invite_code?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "broker_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comparisons: {
        Row: {
          client_name: string | null
          comparison_data: Json | null
          created_at: string
          description: string | null
          id: string
          name: string
          quote_ids: string[]
          risk_profile: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_name?: string | null
          comparison_data?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          quote_ids: string[]
          risk_profile?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_name?: string | null
          comparison_data?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          quote_ids?: string[]
          risk_profile?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coverage_categories: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string
          id: string
          is_predefined: boolean | null
          name: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          is_predefined?: boolean | null
          name: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          is_predefined?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "coverage_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "broker_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          file_size: number | null
          file_type: string
          filename: string
          id: string
          processing_error: string | null
          status: string | null
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_size?: number | null
          file_type: string
          filename: string
          id?: string
          processing_error?: string | null
          status?: string | null
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_size?: number | null
          file_type?: string
          filename?: string
          id?: string
          processing_error?: string | null
          status?: string | null
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      file_access_audit: {
        Row: {
          action_type: string
          created_at: string | null
          error_message: string | null
          file_id: string | null
          file_path: string | null
          id: string
          ip_address: unknown | null
          metadata: Json | null
          success: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          error_message?: string | null
          file_id?: string | null
          file_path?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          success?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          error_message?: string | null
          file_id?: string | null
          file_path?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          success?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gap_analyses: {
        Row: {
          attack_strategy: string | null
          comparison_id: string | null
          competitive_advantages: string[] | null
          coverage_gaps: Json
          created_at: string
          id: string
          incumbent_quote_id: string | null
          key_weaknesses: string[] | null
          opportunity_score: number
          switch_evidence: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attack_strategy?: string | null
          comparison_id?: string | null
          competitive_advantages?: string[] | null
          coverage_gaps: Json
          created_at?: string
          id?: string
          incumbent_quote_id?: string | null
          key_weaknesses?: string[] | null
          opportunity_score: number
          switch_evidence?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attack_strategy?: string | null
          comparison_id?: string | null
          competitive_advantages?: string[] | null
          coverage_gaps?: Json
          created_at?: string
          id?: string
          incumbent_quote_id?: string | null
          key_weaknesses?: string[] | null
          opportunity_score?: number
          switch_evidence?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gap_analyses_comparison_id_fkey"
            columns: ["comparison_id"]
            isOneToOne: false
            referencedRelation: "comparisons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gap_analyses_incumbent_quote_id_fkey"
            columns: ["incumbent_quote_id"]
            isOneToOne: false
            referencedRelation: "structured_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      login_audit: {
        Row: {
          failure_reason: string | null
          id: string
          ip_address: unknown | null
          login_time: string
          portal_type: Database["public"]["Enums"]["portal_type"]
          success: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          failure_reason?: string | null
          id?: string
          ip_address?: unknown | null
          login_time?: string
          portal_type: Database["public"]["Enums"]["portal_type"]
          success?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          failure_reason?: string | null
          id?: string
          ip_address?: unknown | null
          login_time?: string
          portal_type?: Database["public"]["Enums"]["portal_type"]
          success?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      market_intelligence: {
        Row: {
          appetite_score: number | null
          avg_premium_rate: number | null
          company_id: string
          created_by: string | null
          data_points: number | null
          id: string
          industry: string | null
          insurer_name: string
          last_updated: string
          preferences: Json | null
          product_type: string
          revenue_band_max: number | null
          revenue_band_min: number | null
          typical_limits: Json | null
          win_rate: number | null
        }
        Insert: {
          appetite_score?: number | null
          avg_premium_rate?: number | null
          company_id: string
          created_by?: string | null
          data_points?: number | null
          id?: string
          industry?: string | null
          insurer_name: string
          last_updated?: string
          preferences?: Json | null
          product_type: string
          revenue_band_max?: number | null
          revenue_band_min?: number | null
          typical_limits?: Json | null
          win_rate?: number | null
        }
        Update: {
          appetite_score?: number | null
          avg_premium_rate?: number | null
          company_id?: string
          created_by?: string | null
          data_points?: number | null
          id?: string
          industry?: string | null
          insurer_name?: string
          last_updated?: string
          preferences?: Json | null
          product_type?: string
          revenue_band_max?: number | null
          revenue_band_min?: number | null
          typical_limits?: Json | null
          win_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "market_intelligence_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "broker_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      market_predictions: {
        Row: {
          average_response_days: number | null
          capacity_status: string | null
          company_id: string | null
          created_at: string
          data_points_count: number | null
          id: string
          industry: string | null
          last_updated: string
          product_type: string | null
          quote_probability: number | null
          revenue_band: string | null
          typical_premium_adjustment: number | null
          underwriter_name: string
          win_probability: number | null
        }
        Insert: {
          average_response_days?: number | null
          capacity_status?: string | null
          company_id?: string | null
          created_at?: string
          data_points_count?: number | null
          id?: string
          industry?: string | null
          last_updated?: string
          product_type?: string | null
          quote_probability?: number | null
          revenue_band?: string | null
          typical_premium_adjustment?: number | null
          underwriter_name: string
          win_probability?: number | null
        }
        Update: {
          average_response_days?: number | null
          capacity_status?: string | null
          company_id?: string | null
          created_at?: string
          data_points_count?: number | null
          id?: string
          industry?: string | null
          last_updated?: string
          product_type?: string | null
          quote_probability?: number | null
          revenue_band?: string | null
          typical_premium_adjustment?: number | null
          underwriter_name?: string
          win_probability?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "market_predictions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "broker_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pii_access_audit: {
        Row: {
          access_method: string
          accessed_user_id: string
          accessing_user_id: string
          blocked_reason: string | null
          consent_given: boolean | null
          consent_required: boolean | null
          created_at: string | null
          data_type: string
          fields_accessed: string[] | null
          id: string
          ip_address: unknown | null
          metadata: Json | null
          purpose: string | null
          risk_score: number | null
          session_id: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          access_method: string
          accessed_user_id: string
          accessing_user_id: string
          blocked_reason?: string | null
          consent_given?: boolean | null
          consent_required?: boolean | null
          created_at?: string | null
          data_type: string
          fields_accessed?: string[] | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          purpose?: string | null
          risk_score?: number | null
          session_id?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          access_method?: string
          accessed_user_id?: string
          accessing_user_id?: string
          blocked_reason?: string | null
          consent_given?: boolean | null
          consent_required?: boolean | null
          created_at?: string | null
          data_type?: string
          fields_accessed?: string[] | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          purpose?: string | null
          risk_score?: number | null
          session_id?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      placement_outcomes: {
        Row: {
          business_type: string | null
          competitiveness_score: number | null
          coverage_limits: Json | null
          created_at: string
          id: string
          industry: string | null
          notes: string | null
          outcome: string
          placed_at: string | null
          policy_type: string | null
          premium_amount: number | null
          product_type: string | null
          quote_id: string | null
          response_time_days: number | null
          underwriter_name: string
          updated_at: string
          user_id: string
          win_reason: string | null
        }
        Insert: {
          business_type?: string | null
          competitiveness_score?: number | null
          coverage_limits?: Json | null
          created_at?: string
          id?: string
          industry?: string | null
          notes?: string | null
          outcome: string
          placed_at?: string | null
          policy_type?: string | null
          premium_amount?: number | null
          product_type?: string | null
          quote_id?: string | null
          response_time_days?: number | null
          underwriter_name: string
          updated_at?: string
          user_id: string
          win_reason?: string | null
        }
        Update: {
          business_type?: string | null
          competitiveness_score?: number | null
          coverage_limits?: Json | null
          created_at?: string
          id?: string
          industry?: string | null
          notes?: string | null
          outcome?: string
          placed_at?: string | null
          policy_type?: string | null
          premium_amount?: number | null
          product_type?: string | null
          quote_id?: string | null
          response_time_days?: number | null
          underwriter_name?: string
          updated_at?: string
          user_id?: string
          win_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "placement_outcomes_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "structured_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      placement_policy_types: {
        Row: {
          created_at: string
          id: string
          placement_outcome_id: string
          policy_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          placement_outcome_id: string
          policy_type: string
        }
        Update: {
          created_at?: string
          id?: string
          placement_outcome_id?: string
          policy_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "placement_policy_types_placement_outcome_id_fkey"
            columns: ["placement_outcome_id"]
            isOneToOne: false
            referencedRelation: "placement_outcomes"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_wordings: {
        Row: {
          coverage_sections: Json | null
          created_at: string
          document_id: string | null
          emerging_risks: Json | null
          id: string
          insured_name: string | null
          insurer_name: string
          jurisdiction: string | null
          key_variables: Json | null
          plain_language_summary: Json | null
          policy_date: string | null
          policy_period: string | null
          policy_version: string | null
          processing_error: string | null
          services: Json | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          coverage_sections?: Json | null
          created_at?: string
          document_id?: string | null
          emerging_risks?: Json | null
          id?: string
          insured_name?: string | null
          insurer_name: string
          jurisdiction?: string | null
          key_variables?: Json | null
          plain_language_summary?: Json | null
          policy_date?: string | null
          policy_period?: string | null
          policy_version?: string | null
          processing_error?: string | null
          services?: Json | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          coverage_sections?: Json | null
          created_at?: string
          document_id?: string | null
          emerging_risks?: Json | null
          id?: string
          insured_name?: string | null
          insurer_name?: string
          jurisdiction?: string | null
          key_variables?: Json | null
          plain_language_summary?: Json | null
          policy_date?: string | null
          policy_period?: string | null
          policy_version?: string | null
          processing_error?: string | null
          services?: Json | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_wordings_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_access_audit: {
        Row: {
          access_reason: string | null
          access_type: string
          accessed_fields: string[] | null
          accessed_user_id: string
          accessing_user_id: string
          created_at: string | null
          id: string
          ip_address: unknown | null
          user_agent: string | null
        }
        Insert: {
          access_reason?: string | null
          access_type: string
          accessed_fields?: string[] | null
          accessed_user_id: string
          accessing_user_id: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
        }
        Update: {
          access_reason?: string | null
          access_type?: string
          accessed_fields?: string[] | null
          accessed_user_id?: string
          accessing_user_id?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
        }
        Relationships: []
      }
      profile_sensitive_data: {
        Row: {
          created_at: string | null
          emergency_contact: Json | null
          id: string
          personal_address: string | null
          phone: string | null
          sensitive_notes: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emergency_contact?: Json | null
          id?: string
          personal_address?: string | null
          phone?: string | null
          sensitive_notes?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          emergency_contact?: Json | null
          id?: string
          personal_address?: string | null
          phone?: string | null
          sensitive_notes?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          broker_type: string | null
          company_id: string | null
          company_name: string | null
          created_at: string
          department: string | null
          first_name: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean | null
          is_super_admin: boolean | null
          job_title: string | null
          last_login_at: string | null
          last_name: string | null
          login_count: number | null
          portal_access: Database["public"]["Enums"]["portal_type"] | null
          preferred_portal: Database["public"]["Enums"]["portal_type"] | null
          role: Database["public"]["Enums"]["app_role"] | null
          subscription_tier: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          broker_type?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          department?: string | null
          first_name?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          is_super_admin?: boolean | null
          job_title?: string | null
          last_login_at?: string | null
          last_name?: string | null
          login_count?: number | null
          portal_access?: Database["public"]["Enums"]["portal_type"] | null
          preferred_portal?: Database["public"]["Enums"]["portal_type"] | null
          role?: Database["public"]["Enums"]["app_role"] | null
          subscription_tier?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          broker_type?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          department?: string | null
          first_name?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          is_super_admin?: boolean | null
          job_title?: string | null
          last_login_at?: string | null
          last_name?: string | null
          login_count?: number | null
          portal_access?: Database["public"]["Enums"]["portal_type"] | null
          preferred_portal?: Database["public"]["Enums"]["portal_type"] | null
          role?: Database["public"]["Enums"]["app_role"] | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "broker_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          comparison_id: string
          created_at: string
          export_format: string | null
          id: string
          report_data: Json
          report_type: string | null
          storage_path: string | null
          user_id: string
        }
        Insert: {
          comparison_id: string
          created_at?: string
          export_format?: string | null
          id?: string
          report_data: Json
          report_type?: string | null
          storage_path?: string | null
          user_id: string
        }
        Update: {
          comparison_id?: string
          created_at?: string
          export_format?: string | null
          id?: string
          report_data?: Json
          report_type?: string | null
          storage_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_comparison_id_fkey"
            columns: ["comparison_id"]
            isOneToOne: false
            referencedRelation: "comparisons"
            referencedColumns: ["id"]
          },
        ]
      }
      sensitive_data_access_audit: {
        Row: {
          access_reason: string | null
          access_timestamp: string | null
          access_type: string
          accessed_fields: string[] | null
          accessed_user_id: string
          accessing_user_id: string
          id: string
          ip_address: unknown | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          access_reason?: string | null
          access_timestamp?: string | null
          access_type: string
          accessed_fields?: string[] | null
          accessed_user_id: string
          accessing_user_id: string
          id?: string
          ip_address?: unknown | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          access_reason?: string | null
          access_timestamp?: string | null
          access_type?: string
          accessed_fields?: string[] | null
          accessed_user_id?: string
          accessing_user_id?: string
          id?: string
          ip_address?: unknown | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      sensitive_data_access_sessions: {
        Row: {
          access_count: number | null
          accessed_fields: string[] | null
          auto_expire_minutes: number | null
          created_at: string
          expires_at: string
          hr_user_id: string
          id: string
          ip_address: unknown | null
          purpose: string
          revoked_at: string | null
          session_token: string
          target_user_id: string
          user_agent: string | null
        }
        Insert: {
          access_count?: number | null
          accessed_fields?: string[] | null
          auto_expire_minutes?: number | null
          created_at?: string
          expires_at: string
          hr_user_id: string
          id?: string
          ip_address?: unknown | null
          purpose: string
          revoked_at?: string | null
          session_token: string
          target_user_id: string
          user_agent?: string | null
        }
        Update: {
          access_count?: number | null
          accessed_fields?: string[] | null
          auto_expire_minutes?: number | null
          created_at?: string
          expires_at?: string
          hr_user_id?: string
          id?: string
          ip_address?: unknown | null
          purpose?: string
          revoked_at?: string | null
          session_token?: string
          target_user_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      sensitive_data_consent: {
        Row: {
          consent_type: string
          consented_by: string
          created_at: string
          expires_at: string | null
          granted_at: string
          id: string
          purpose: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          consent_type: string
          consented_by: string
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          purpose: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          consent_type?: string
          consented_by?: string
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          purpose?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      structured_quotes: {
        Row: {
          client_name: string
          coverage_limits: Json | null
          created_at: string
          deductible_amount: number | null
          document_id: string | null
          exclusions: string[] | null
          expiry_date: string | null
          id: string
          inclusions: string[] | null
          industry: string | null
          inner_limits: Json | null
          insurer_name: string
          policy_terms: Json | null
          premium_amount: number | null
          premium_currency: string | null
          product_type: string | null
          quote_date: string | null
          quote_status: string | null
          revenue_band: string | null
          subjectivities: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_name: string
          coverage_limits?: Json | null
          created_at?: string
          deductible_amount?: number | null
          document_id?: string | null
          exclusions?: string[] | null
          expiry_date?: string | null
          id?: string
          inclusions?: string[] | null
          industry?: string | null
          inner_limits?: Json | null
          insurer_name: string
          policy_terms?: Json | null
          premium_amount?: number | null
          premium_currency?: string | null
          product_type?: string | null
          quote_date?: string | null
          quote_status?: string | null
          revenue_band?: string | null
          subjectivities?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_name?: string
          coverage_limits?: Json | null
          created_at?: string
          deductible_amount?: number | null
          document_id?: string | null
          exclusions?: string[] | null
          expiry_date?: string | null
          id?: string
          inclusions?: string[] | null
          industry?: string | null
          inner_limits?: Json | null
          insurer_name?: string
          policy_terms?: Json | null
          premium_amount?: number | null
          premium_currency?: string | null
          product_type?: string | null
          quote_date?: string | null
          quote_status?: string | null
          revenue_band?: string | null
          subjectivities?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "structured_quotes_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      underwriter_appetite_data: {
        Row: {
          additional_products: string[] | null
          appetite_document_id: string
          broker_features: Json | null
          coverage_amount_max: number | null
          coverage_amount_min: number | null
          coverage_limits: Json | null
          created_at: string
          distribution_type: string | null
          employee_range_max: number | null
          employee_range_min: number | null
          exclusions: string[] | null
          financial_ratings: Json | null
          geographic_coverage: string[] | null
          id: string
          industry_classes: string[] | null
          jurisdictions: string[] | null
          logo_url: string | null
          maximum_premium: number | null
          minimum_premium: number | null
          placement_notes: string | null
          policy_features: Json | null
          product_type: string | null
          revenue_range_max: number | null
          revenue_range_min: number | null
          risk_appetite: string | null
          security_requirements: string[] | null
          segments: string[] | null
          specialty_focus: string[] | null
          target_sectors: string[] | null
          underwriter_name: string
          updated_at: string
        }
        Insert: {
          additional_products?: string[] | null
          appetite_document_id: string
          broker_features?: Json | null
          coverage_amount_max?: number | null
          coverage_amount_min?: number | null
          coverage_limits?: Json | null
          created_at?: string
          distribution_type?: string | null
          employee_range_max?: number | null
          employee_range_min?: number | null
          exclusions?: string[] | null
          financial_ratings?: Json | null
          geographic_coverage?: string[] | null
          id?: string
          industry_classes?: string[] | null
          jurisdictions?: string[] | null
          logo_url?: string | null
          maximum_premium?: number | null
          minimum_premium?: number | null
          placement_notes?: string | null
          policy_features?: Json | null
          product_type?: string | null
          revenue_range_max?: number | null
          revenue_range_min?: number | null
          risk_appetite?: string | null
          security_requirements?: string[] | null
          segments?: string[] | null
          specialty_focus?: string[] | null
          target_sectors?: string[] | null
          underwriter_name: string
          updated_at?: string
        }
        Update: {
          additional_products?: string[] | null
          appetite_document_id?: string
          broker_features?: Json | null
          coverage_amount_max?: number | null
          coverage_amount_min?: number | null
          coverage_limits?: Json | null
          created_at?: string
          distribution_type?: string | null
          employee_range_max?: number | null
          employee_range_min?: number | null
          exclusions?: string[] | null
          financial_ratings?: Json | null
          geographic_coverage?: string[] | null
          id?: string
          industry_classes?: string[] | null
          jurisdictions?: string[] | null
          logo_url?: string | null
          maximum_premium?: number | null
          minimum_premium?: number | null
          placement_notes?: string | null
          policy_features?: Json | null
          product_type?: string | null
          revenue_range_max?: number | null
          revenue_range_min?: number | null
          risk_appetite?: string | null
          security_requirements?: string[] | null
          segments?: string[] | null
          specialty_focus?: string[] | null
          target_sectors?: string[] | null
          underwriter_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "underwriter_appetite_data_appetite_document_id_fkey"
            columns: ["appetite_document_id"]
            isOneToOne: false
            referencedRelation: "underwriter_appetites"
            referencedColumns: ["id"]
          },
        ]
      }
      underwriter_appetites: {
        Row: {
          company_id: string | null
          coverage_category: string | null
          created_at: string
          document_type: string
          file_size: number | null
          file_type: string
          filename: string
          id: string
          logo_url: string | null
          processing_error: string | null
          source_url: string | null
          status: string
          storage_path: string
          underwriter_name: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          company_id?: string | null
          coverage_category?: string | null
          created_at?: string
          document_type?: string
          file_size?: number | null
          file_type: string
          filename: string
          id?: string
          logo_url?: string | null
          processing_error?: string | null
          source_url?: string | null
          status?: string
          storage_path: string
          underwriter_name: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          company_id?: string | null
          coverage_category?: string | null
          created_at?: string
          document_type?: string
          file_size?: number | null
          file_type?: string
          filename?: string
          id?: string
          logo_url?: string | null
          processing_error?: string | null
          source_url?: string | null
          status?: string
          storage_path?: string
          underwriter_name?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "underwriter_appetites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "broker_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      underwriter_matches: {
        Row: {
          appetite_document_id: string
          compatibility_factors: Json | null
          competitive_advantages: string[] | null
          coverage_gaps: Json | null
          created_at: string | null
          document_id: string
          id: string
          match_rank: number
          match_reasoning: Json
          match_score: number
          recommended_premium_range: Json | null
          risk_assessment: string | null
          underwriter_name: string
          updated_at: string | null
        }
        Insert: {
          appetite_document_id: string
          compatibility_factors?: Json | null
          competitive_advantages?: string[] | null
          coverage_gaps?: Json | null
          created_at?: string | null
          document_id: string
          id?: string
          match_rank: number
          match_reasoning: Json
          match_score: number
          recommended_premium_range?: Json | null
          risk_assessment?: string | null
          underwriter_name: string
          updated_at?: string | null
        }
        Update: {
          appetite_document_id?: string
          compatibility_factors?: Json | null
          competitive_advantages?: string[] | null
          coverage_gaps?: Json | null
          created_at?: string | null
          document_id?: string
          id?: string
          match_rank?: number
          match_reasoning?: Json
          match_score?: number
          recommended_premium_range?: Json | null
          risk_assessment?: string | null
          underwriter_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "underwriter_matches_appetite_document_id_fkey"
            columns: ["appetite_document_id"]
            isOneToOne: false
            referencedRelation: "underwriter_appetites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "underwriter_matches_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "structured_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      market_intelligence_aggregated: {
        Row: {
          avg_competitiveness_score: number | null
          avg_premium: number | null
          avg_response_time: number | null
          company_id: string | null
          data_source: string | null
          declines: number | null
          industry: string | null
          last_placement_date: string | null
          max_premium: number | null
          min_premium: number | null
          policy_type: string | null
          product_type: string | null
          quote_rate_percentage: number | null
          quotes: number | null
          total_placements: number | null
          underwriter_name: string | null
          win_rate_percentage: number | null
          wins: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "broker_companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      analyze_quote_coverage: {
        Args: { p_analysis_criteria?: Json; p_quote_id: string }
        Returns: Json
      }
      can_access_profile: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      cleanup_expired_access_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_security_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_audit_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_sensitive_audit_logs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_market_intelligence: {
        Args: {
          p_appetite_score?: number
          p_avg_premium_rate?: number
          p_industry?: string
          p_insurer_name: string
          p_preferences?: Json
          p_product_type: string
          p_revenue_band_max?: number
          p_revenue_band_min?: number
          p_typical_limits?: Json
          p_win_rate?: number
        }
        Returns: string
      }
      create_sensitive_data_session: {
        Args: {
          duration_minutes?: number
          purpose: string
          target_user_id: string
        }
        Returns: string
      }
      expire_old_consents: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_company_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_invite_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_secure_invite_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_accessible_sensitive_data: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          emergency_contact: Json
          id: string
          personal_address: string
          phone: string
          sensitive_notes: string
          updated_at: string
          user_id: string
        }[]
      }
      get_accessible_team_members: {
        Args: Record<PropertyKey, never>
        Returns: {
          company_id: string
          created_at: string
          department: string
          first_name: string
          is_active: boolean
          job_title: string
          last_login_at: string
          last_name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      get_best_underwriter_matches: {
        Args: { p_document_id: string; p_limit?: number }
        Returns: {
          appetite_document_id: string
          compatibility_factors: Json
          competitive_advantages: string[]
          coverage_gaps: Json
          financial_ratings: Json
          id: string
          logo_url: string
          match_rank: number
          match_reasoning: Json
          match_score: number
          recommended_premium_range: Json
          risk_assessment: string
          underwriter_name: string
        }[]
      }
      get_masked_sensitive_data: {
        Args: { target_user_id: string }
        Returns: {
          address_masked: string
          emergency_contact_exists: boolean
          has_sensitive_notes: boolean
          id: string
          last_updated: string
          phone_masked: string
          user_id: string
        }[]
      }
      get_masked_sensitive_data_secure: {
        Args: { target_user_id: string }
        Returns: {
          access_level: string
          created_at: string
          emergency_contact: Json
          id: string
          personal_address: string
          phone: string
          sensitive_notes: string
          updated_at: string
          user_id: string
        }[]
      }
      get_policy_type_intelligence: {
        Args: {
          p_industry?: string
          p_max_premium?: number
          p_min_premium?: number
          p_policy_types: string[]
        }
        Returns: {
          avg_premium: number
          avg_response_time: number
          competitiveness_ranking: number
          industry: string
          policy_type: string
          quote_rate_percentage: number
          total_placements: number
          underwriter_name: string
          win_rate_percentage: number
        }[]
      }
      get_sensitive_data_with_consent: {
        Args: { access_reason?: string; target_user_id: string }
        Returns: {
          created_at: string
          emergency_contact: Json
          id: string
          personal_address: string
          phone: string
          sensitive_notes: string
          updated_at: string
          user_id: string
        }[]
      }
      get_team_member_safe_data: {
        Args: { target_user_id: string }
        Returns: {
          created_at: string
          department: string
          first_name: string
          is_active: boolean
          job_title: string
          last_login_at: string
          last_name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      get_team_member_secure: {
        Args: { target_user_id: string }
        Returns: {
          department: string
          first_name: string
          is_active: boolean
          job_title: string
          last_login_at: string
          last_name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      get_user_company_id: {
        Args: { user_id: string }
        Returns: string
      }
      get_user_portal_access: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["portal_type"]
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      grant_sensitive_data_consent: {
        Args: {
          consent_type: string
          expires_in_days?: number
          hr_user_id: string
          purpose: string
        }
        Returns: string
      }
      has_sensitive_data_consent: {
        Args: { consent_type: string; target_user_id: string }
        Returns: boolean
      }
      is_company_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      is_hr_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      is_same_company_user: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      is_super_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      log_file_access: {
        Args: {
          p_action_type: string
          p_error_message?: string
          p_file_id?: string
          p_file_path?: string
          p_ip_address?: unknown
          p_metadata?: Json
          p_success?: boolean
          p_user_agent?: string
          p_user_id: string
        }
        Returns: undefined
      }
      log_hr_sensitive_access: {
        Args: { access_reason?: string; target_user_id: string }
        Returns: undefined
      }
      log_login_attempt: {
        Args: {
          p_failure_reason?: string
          p_ip_address?: unknown
          p_portal_type: Database["public"]["Enums"]["portal_type"]
          p_success?: boolean
          p_user_agent?: string
          p_user_id: string
        }
        Returns: undefined
      }
      log_pii_access: {
        Args: {
          p_access_method: string
          p_accessed_user_id: string
          p_accessing_user_id: string
          p_blocked_reason?: string
          p_consent_given?: boolean
          p_consent_required?: boolean
          p_data_type: string
          p_fields_accessed?: string[]
          p_ip_address?: unknown
          p_metadata?: Json
          p_purpose?: string
          p_risk_score?: number
          p_session_id?: string
          p_success?: boolean
          p_user_agent?: string
        }
        Returns: undefined
      }
      log_profile_access: {
        Args: {
          p_access_reason?: string
          p_access_type: string
          p_accessed_fields?: string[]
          p_accessed_user_id: string
          p_ip_address?: unknown
          p_user_agent?: string
        }
        Returns: undefined
      }
      log_security_violation: {
        Args: {
          attempted_resource: string
          details?: Json
          violation_type: string
        }
        Returns: undefined
      }
      log_sensitive_data_access: {
        Args: {
          p_access_reason?: string
          p_access_type: string
          p_accessed_fields?: string[]
          p_accessed_user_id: string
        }
        Returns: undefined
      }
      log_sensitive_operation: {
        Args: {
          p_details?: Json
          p_operation_type: string
          p_record_id: string
          p_table_name: string
        }
        Returns: undefined
      }
      mask_sensitive_field: {
        Args: { field_value: string; mask_type?: string }
        Returns: string
      }
      rank_quotes_for_client: {
        Args: { p_client_id: string; p_quote_ids?: string[] }
        Returns: {
          areas_of_concern: string[]
          competitiveness_score: number
          coverage_score: number
          insurer_name: string
          key_strengths: string[]
          overall_score: number
          premium_amount: number
          quality_score: number
          quote_id: string
          rank_position: number
          recommendation_category: string
        }[]
      }
      request_sensitive_data_access: {
        Args: {
          access_duration_hours?: number
          access_purpose: string
          justification: string
          target_user_id: string
        }
        Returns: string
      }
      respond_to_consent_request: {
        Args: { approved: boolean; consent_id: string; employee_notes?: string }
        Returns: boolean
      }
      revoke_sensitive_data_consent: {
        Args: { consent_type: string; hr_user_id: string }
        Returns: boolean
      }
      trigger_underwriter_matching: {
        Args: { p_document_id: string }
        Returns: boolean
      }
      validate_company_code: {
        Args: { p_code: string }
        Returns: {
          company_id: string
          company_name: string
          is_valid: boolean
        }[]
      }
      validate_enhanced_sensitive_access: {
        Args: {
          access_purpose?: string
          requested_fields?: string[]
          target_user_id: string
        }
        Returns: Json
      }
      validate_invite_code: {
        Args: { p_email: string; p_invite_code: string }
        Returns: {
          company_id: string
          company_name: string
          is_valid: boolean
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      validate_sensitive_data_access: {
        Args: { access_purpose?: string; target_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "company_admin" | "broker" | "viewer" | "hr_admin"
      data_mask_level: "none" | "partial" | "full" | "blocked"
      portal_type: "admin" | "broker" | "both"
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
      app_role: ["company_admin", "broker", "viewer", "hr_admin"],
      data_mask_level: ["none", "partial", "full", "blocked"],
      portal_type: ["admin", "broker", "both"],
    },
  },
} as const
