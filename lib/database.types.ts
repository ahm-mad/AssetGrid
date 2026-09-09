export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      impersonation_log: {
        Row: {
          actor_id: string
          ended_at: string | null
          id: number
          ip: unknown
          started_at: string
          target_id: string
          user_agent: string | null
        }
        Insert: {
          actor_id: string
          ended_at?: string | null
          id?: number
          ip?: unknown
          started_at?: string
          target_id: string
          user_agent?: string | null
        }
        Update: {
          actor_id?: string
          ended_at?: string | null
          id?: number
          ip?: unknown
          started_at?: string
          target_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_log_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: number
          name: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id: number
          name?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: number
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profile_details: {
        Row: {
          address_1: string | null
          address_2: string | null
          city: string | null
          container_codes: string[]
          country: string | null
          created_at: string
          dealer_id: string | null
          email_notification: boolean
          id: number
          inventory_device_ids: number[]
          manager_email: Json | null
          manager_phone: Json | null
          notification_email: Json | null
          notification_phone: Json | null
          phone_notification: boolean
          phone_number: string | null
          phone_type: string | null
          postal_code: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_1?: string | null
          address_2?: string | null
          city?: string | null
          container_codes?: string[]
          country?: string | null
          created_at?: string
          dealer_id?: string | null
          email_notification?: boolean
          id?: number
          inventory_device_ids?: number[]
          manager_email?: Json | null
          manager_phone?: Json | null
          notification_email?: Json | null
          notification_phone?: Json | null
          phone_notification?: boolean
          phone_number?: string | null
          phone_type?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_1?: string | null
          address_2?: string | null
          city?: string | null
          container_codes?: string[]
          country?: string | null
          created_at?: string
          dealer_id?: string | null
          email_notification?: boolean
          id?: number
          inventory_device_ids?: number[]
          manager_email?: Json | null
          manager_phone?: Json | null
          notification_email?: Json | null
          notification_phone?: Json | null
          phone_notification?: boolean
          phone_number?: string | null
          phone_type?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_details_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_details_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: number | null
          created_at: string
          deleted_at: string | null
          domain_id: number | null
          fcm_token: string | null
          first_name: string | null
          id: string
          last_name: string | null
          legacy_id: number | null
          residence_customer: boolean
          role_type_id: number
          updated_at: string
          xnid: string | null
        }
        Insert: {
          company_id?: number | null
          created_at?: string
          deleted_at?: string | null
          domain_id?: number | null
          fcm_token?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          legacy_id?: number | null
          residence_customer?: boolean
          role_type_id?: number
          updated_at?: string
          xnid?: string | null
        }
        Update: {
          company_id?: number | null
          created_at?: string
          deleted_at?: string | null
          domain_id?: number | null
          fcm_token?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          legacy_id?: number | null
          residence_customer?: boolean
          role_type_id?: number
          updated_at?: string
          xnid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_type_id_fkey"
            columns: ["role_type_id"]
            isOneToOne: false
            referencedRelation: "role_types"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_read: boolean
          can_update: boolean
          created_at: string
          module_id: number
          role_type_id: number
          updated_at: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          created_at?: string
          module_id: number
          role_type_id: number
          updated_at?: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          created_at?: string
          module_id?: number
          role_type_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_type_id_fkey"
            columns: ["role_type_id"]
            isOneToOne: false
            referencedRelation: "role_types"
            referencedColumns: ["id"]
          },
        ]
      }
      role_types: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_types_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_read: boolean
          can_update: boolean
          created_at: string
          created_by: string | null
          module_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          created_at?: string
          created_by?: string | null
          module_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          created_at?: string
          created_by?: string | null
          module_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_scopes: {
        Row: {
          asset_ids: number[]
          asset_labels: Json | null
          created_at: string
          created_by: string | null
          entity_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_ids: number[]
          asset_labels?: Json | null
          created_at?: string
          created_by?: string | null
          entity_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_ids?: number[]
          asset_labels?: Json | null
          created_at?: string
          created_by?: string | null
          entity_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_scopes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_scopes_user_id_fkey"
            columns: ["user_id"]
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
      auth_can: {
        Args: { p_action: string; p_module: string; p_user?: string }
        Returns: boolean
      }
      auth_is_customer: { Args: { p_user?: string }; Returns: boolean }
      auth_is_super_admin: { Args: { p_user?: string }; Returns: boolean }
      auth_role_title: { Args: { p_user?: string }; Returns: string }
      auth_scope_allows: {
        Args: { p_asset: number; p_entity: string; p_user?: string }
        Returns: boolean
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      gen_xnid: { Args: { prefix: string }; Returns: string }
    }
    Enums: {
      activation_attempt_status: "pending" | "completed" | "expired" | "failed"
      billing_mode: "direct" | "dealer_assisted" | "dealer_billed"
      charging_timer_kind: "standard" | "quick"
      contract_status: "required" | "sent" | "signed" | "expired" | "cancelled"
      device_assignment_status: "active" | "suspended" | "released" | "inactive"
      entitlement_source: "stripe" | "admin" | "system"
      invoice_status: "unpaid" | "paid" | "void" | "partially_paid"
      neo_alarm_status: "pending" | "success" | "failed" | "partial"
      notification_channel: "email" | "sms"
      payment_provider: "stripe" | "cash"
      pos_txn_type: "charge" | "credit"
      rate_plan_type: "percent" | "fixed"
      scheduler_recurrence: "daily" | "weekly" | "bi-weekly"
      user_device_status: "decline" | "captured"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      activation_attempt_status: ["pending", "completed", "expired", "failed"],
      billing_mode: ["direct", "dealer_assisted", "dealer_billed"],
      charging_timer_kind: ["standard", "quick"],
      contract_status: ["required", "sent", "signed", "expired", "cancelled"],
      device_assignment_status: ["active", "suspended", "released", "inactive"],
      entitlement_source: ["stripe", "admin", "system"],
      invoice_status: ["unpaid", "paid", "void", "partially_paid"],
      neo_alarm_status: ["pending", "success", "failed", "partial"],
      notification_channel: ["email", "sms"],
      payment_provider: ["stripe", "cash"],
      pos_txn_type: ["charge", "credit"],
      rate_plan_type: ["percent", "fixed"],
      scheduler_recurrence: ["daily", "weekly", "bi-weekly"],
      user_device_status: ["decline", "captured"],
    },
  },
} as const

