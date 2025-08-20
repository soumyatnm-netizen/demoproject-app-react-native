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
      market_intelligence: {
        Row: {
          appetite_score: number | null
          avg_premium_rate: number | null
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
        Relationships: []
      }
      profiles: {
        Row: {
          broker_type: string | null
          company_name: string | null
          created_at: string
          id: string
          subscription_tier: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          broker_type?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          subscription_tier?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          broker_type?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      structured_quotes: {
        Row: {
          coverage_limits: Json | null
          created_at: string
          deductible_amount: number | null
          document_id: string
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
          updated_at: string
          user_id: string
        }
        Insert: {
          coverage_limits?: Json | null
          created_at?: string
          deductible_amount?: number | null
          document_id: string
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
          updated_at?: string
          user_id: string
        }
        Update: {
          coverage_limits?: Json | null
          created_at?: string
          deductible_amount?: number | null
          document_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
