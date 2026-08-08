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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          code: string
          created_at: string
          id: string
          is_archived: boolean
          is_system: boolean
          name: string
          subtype: string | null
          type: string
          updated_at: string
          user_id: string
          vat_rate: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_system?: boolean
          name: string
          subtype?: string | null
          type: string
          updated_at?: string
          user_id: string
          vat_rate?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_system?: boolean
          name?: string
          subtype?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          vat_rate?: number
        }
        Relationships: []
      }
      allocation_settings: {
        Row: {
          accounting_basis: string
          created_at: string
          debts_pct: number
          expenses_pct: number
          id: string
          reserve_pct: number
          taxes_pct: number
          updated_at: string
          user_id: string
          vat_rate: number
          vat_registered: boolean
        }
        Insert: {
          accounting_basis?: string
          created_at?: string
          debts_pct?: number
          expenses_pct?: number
          id?: string
          reserve_pct?: number
          taxes_pct?: number
          updated_at?: string
          user_id: string
          vat_rate?: number
          vat_registered?: boolean
        }
        Update: {
          accounting_basis?: string
          created_at?: string
          debts_pct?: number
          expenses_pct?: number
          id?: string
          reserve_pct?: number
          taxes_pct?: number
          updated_at?: string
          user_id?: string
          vat_rate?: number
          vat_registered?: boolean
        }
        Relationships: []
      }
      allocations: {
        Row: {
          amount: number
          bucket: string
          created_at: string
          id: string
          is_auto: boolean
          money_entry_id: string
          note: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          bucket: string
          created_at?: string
          id?: string
          is_auto?: boolean
          money_entry_id: string
          note?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          bucket?: string
          created_at?: string
          id?: string
          is_auto?: boolean
          money_entry_id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocations_money_entry_id_fkey"
            columns: ["money_entry_id"]
            isOneToOne: false
            referencedRelation: "money_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          amount_after: number | null
          amount_before: number | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          entry_id: string | null
          id: string
          summary: string
          user_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          amount_after?: number | null
          amount_before?: number | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          entry_id?: string | null
          id?: string
          summary?: string
          user_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          amount_after?: number | null
          amount_before?: number | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          entry_id?: string | null
          id?: string
          summary?: string
          user_id?: string
        }
        Relationships: []
      }
      bills: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          due_date: string
          id: string
          is_recurring: boolean
          issue_date: string
          notes: string
          paid_at: string | null
          status: string
          supplier: string
          updated_at: string
          user_id: string
          vat_amount: number
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          is_recurring?: boolean
          issue_date?: string
          notes?: string
          paid_at?: string | null
          status?: string
          supplier?: string
          updated_at?: string
          user_id: string
          vat_amount?: number
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          is_recurring?: boolean
          issue_date?: string
          notes?: string
          paid_at?: string | null
          status?: string
          supplier?: string
          updated_at?: string
          user_id?: string
          vat_amount?: number
        }
        Relationships: []
      }
      client_notes: {
        Row: {
          client_id: string
          content: string
          created_at: string
          follow_up_date: string | null
          id: string
          is_completed: boolean
          user_id: string
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string
          follow_up_date?: string | null
          id?: string
          is_completed?: boolean
          user_id: string
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string
          follow_up_date?: string | null
          id?: string
          is_completed?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          client_id: string | null
          created_at: string
          document_id: string | null
          expected_close_date: string | null
          id: string
          notes: string | null
          owner_member_id: string | null
          source: string
          stage: string
          stage_order: number
          title: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          document_id?: string | null
          expected_close_date?: string | null
          id?: string
          notes?: string | null
          owner_member_id?: string | null
          source?: string
          stage?: string
          stage_order?: number
          title: string
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          client_id?: string | null
          created_at?: string
          document_id?: string | null
          expected_close_date?: string | null
          id?: string
          notes?: string | null
          owner_member_id?: string | null
          source?: string
          stage?: string
          stage_order?: number
          title?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_member_id_fkey"
            columns: ["owner_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          business_info: Json
          client_id: string | null
          client_info: Json
          cost_items: Json
          created_at: string
          due_date: string | null
          id: string
          invoice_number: string | null
          issue_date: string | null
          items: Json
          quote_number: string
          receipt_number: string | null
          tax_rate: number
          terms_and_conditions: string
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          business_info?: Json
          client_id?: string | null
          client_info?: Json
          cost_items?: Json
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          items?: Json
          quote_number: string
          receipt_number?: string | null
          tax_rate?: number
          terms_and_conditions?: string
          title?: string
          type?: string
          user_id?: string | null
        }
        Update: {
          business_info?: Json
          client_id?: string | null
          client_info?: Json
          cost_items?: Json
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          items?: Json
          quote_number?: string
          receipt_number?: string | null
          tax_rate?: number
          terms_and_conditions?: string
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          contact_name: string | null
          cost_center: string | null
          created_at: string
          entry_date: string
          id: string
          is_reconciled: boolean
          memo: string
          reconciled_at: string | null
          reference: string | null
          source_id: string | null
          source_type: string
          updated_at: string
          user_id: string
          voucher_number: string | null
          voucher_type: string
        }
        Insert: {
          contact_name?: string | null
          cost_center?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          is_reconciled?: boolean
          memo?: string
          reconciled_at?: string | null
          reference?: string | null
          source_id?: string | null
          source_type?: string
          updated_at?: string
          user_id: string
          voucher_number?: string | null
          voucher_type?: string
        }
        Update: {
          contact_name?: string | null
          cost_center?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          is_reconciled?: boolean
          memo?: string
          reconciled_at?: string | null
          reference?: string | null
          source_id?: string | null
          source_type?: string
          updated_at?: string
          user_id?: string
          voucher_number?: string | null
          voucher_type?: string
        }
        Relationships: []
      }
      journal_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          debit: number
          description: string
          entry_id: string
          id: string
          user_id: string
          vat_amount: number
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string
          entry_id: string
          id?: string
          user_id: string
          vat_amount?: number
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string
          entry_id?: string
          id?: string
          user_id?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_forms: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          slug: string
          source_label: string
          submit_label: string
          thank_you_message: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          slug: string
          source_label?: string
          submit_label?: string
          thank_you_message?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          slug?: string
          source_label?: string
          submit_label?: string
          thank_you_message?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          client_id: string | null
          company: string
          created_at: string
          deal_id: string | null
          email: string
          form_id: string | null
          id: string
          name: string
          next_follow_up: string | null
          notes: string
          owner_member_id: string | null
          phone: string
          source: string
          status: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          client_id?: string | null
          company?: string
          created_at?: string
          deal_id?: string | null
          email?: string
          form_id?: string | null
          id?: string
          name: string
          next_follow_up?: string | null
          notes?: string
          owner_member_id?: string | null
          phone?: string
          source?: string
          status?: string
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          client_id?: string | null
          company?: string
          created_at?: string
          deal_id?: string | null
          email?: string
          form_id?: string | null
          id?: string
          name?: string
          next_follow_up?: string | null
          notes?: string
          owner_member_id?: string | null
          phone?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "lead_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_member_id_fkey"
            columns: ["owner_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          agenda: string
          client_id: string | null
          created_at: string
          deal_id: string | null
          duration_min: number
          id: string
          lead_id: string | null
          location: string
          meeting_at: string
          member_id: string | null
          outcome: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agenda?: string
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          duration_min?: number
          id?: string
          lead_id?: string | null
          location?: string
          meeting_at?: string
          member_id?: string | null
          outcome?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agenda?: string
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          duration_min?: number
          id?: string
          lead_id?: string | null
          location?: string
          meeting_at?: string
          member_id?: string | null
          outcome?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      money_entries: {
        Row: {
          amount: number
          client_name: string | null
          cost_items: Json
          created_at: string
          document_id: string | null
          entry_date: string
          id: string
          items: Json
          receipt_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          client_name?: string | null
          cost_items?: Json
          created_at?: string
          document_id?: string | null
          entry_date?: string
          id?: string
          items?: Json
          receipt_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          client_name?: string | null
          cost_items?: Json
          created_at?: string
          document_id?: string | null
          entry_date?: string
          id?: string
          items?: Json
          receipt_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "money_entries_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          business_address: string | null
          business_email: string | null
          business_logo: string | null
          business_name: string | null
          business_phone: string | null
          created_at: string
          display_name: string | null
          footer_line_1: string | null
          footer_line_2: string | null
          footer_page_format: string | null
          footer_reference: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          business_address?: string | null
          business_email?: string | null
          business_logo?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string
          display_name?: string | null
          footer_line_1?: string | null
          footer_line_2?: string | null
          footer_page_format?: string | null
          footer_reference?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          business_address?: string | null
          business_email?: string | null
          business_logo?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string
          display_name?: string | null
          footer_line_1?: string | null
          footer_line_2?: string | null
          footer_page_format?: string | null
          footer_reference?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          phone: string
          role: string
          target: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string
          role?: string
          target?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string
          role?: string
          target?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      voucher_sequences: {
        Row: {
          created_at: string
          id: string
          last_number: number
          prefix: string
          updated_at: string
          user_id: string
          voucher_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_number?: number
          prefix?: string
          updated_at?: string
          user_id: string
          voucher_type: string
        }
        Update: {
          created_at?: string
          id?: string
          last_number?: number
          prefix?: string
          updated_at?: string
          user_id?: string
          voucher_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_lead_form: {
        Args: { _slug: string }
        Returns: {
          description: string
          id: string
          slug: string
          submit_label: string
          thank_you_message: string
          title: string
        }[]
      }
      next_voucher_number: { Args: { _voucher_type: string }; Returns: string }
      seed_chart_of_accounts: { Args: never; Returns: undefined }
      submit_public_lead: {
        Args: {
          _company?: string
          _email?: string
          _name: string
          _notes?: string
          _phone?: string
          _slug: string
        }
        Returns: string
      }
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
