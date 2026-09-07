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
      policies: {
        Row: {
          applied_snapshot_id: string
          normalized: Json
          source_id: string
          updated_at: string
        }
        Insert: {
          applied_snapshot_id: string
          normalized: Json
          source_id: string
          updated_at?: string
        }
        Update: {
          applied_snapshot_id?: string
          normalized?: Json
          source_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policies_source_id_applied_snapshot_id_fkey"
            columns: ["source_id", "applied_snapshot_id"]
            isOneToOne: false
            referencedRelation: "policy_source_snapshots"
            referencedColumns: ["source_id", "id"]
          },
          {
            foreignKeyName: "policies_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: true
            referencedRelation: "policy_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_source_snapshots: {
        Row: {
          captured_at: string
          hash_version: string
          id: string
          raw: Json
          raw_hash: string
          source_id: string
        }
        Insert: {
          captured_at?: string
          hash_version: string
          id?: string
          raw: Json
          raw_hash: string
          source_id: string
        }
        Update: {
          captured_at?: string
          hash_version?: string
          id?: string
          raw?: Json
          raw_hash?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_source_snapshots_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "policy_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_sources: {
        Row: {
          external_id: string
          id: string
          observed_at: string
          provider: string
          succeeded_at: string | null
        }
        Insert: {
          external_id: string
          id?: string
          observed_at?: string
          provider: string
          succeeded_at?: string | null
        }
        Update: {
          external_id?: string
          id?: string
          observed_at?: string
          provider?: string
          succeeded_at?: string | null
        }
        Relationships: []
      }
      policy_sync_items: {
        Row: {
          attempt_history: Json
          attempts: number
          before_snapshot_id: string | null
          changes: Json
          error_code: string | null
          evidence: Json
          external_id: string
          run_id: string
          snapshot_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_history?: Json
          attempts?: number
          before_snapshot_id?: string | null
          changes?: Json
          error_code?: string | null
          evidence?: Json
          external_id: string
          run_id: string
          snapshot_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_history?: Json
          attempts?: number
          before_snapshot_id?: string | null
          changes?: Json
          error_code?: string | null
          evidence?: Json
          external_id?: string
          run_id?: string
          snapshot_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_sync_items_before_snapshot_id_fkey"
            columns: ["before_snapshot_id"]
            isOneToOne: false
            referencedRelation: "policy_source_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_sync_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "policy_sync_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_sync_items_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "policy_source_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_sync_locks: {
        Row: {
          expires_at: string
          generation: number
          name: string
          owner: string | null
        }
        Insert: {
          expires_at?: string
          generation?: number
          name: string
          owner?: string | null
        }
        Update: {
          expires_at?: string
          generation?: number
          name?: string
          owner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policy_sync_locks_owner_fkey"
            columns: ["owner"]
            isOneToOne: false
            referencedRelation: "policy_sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_sync_runs: {
        Row: {
          calls: number
          finished_at: string | null
          id: string
          provider: string
          scope: Json
          started_at: string
          status: string
          summary: Json
          trigger: string
        }
        Insert: {
          calls?: number
          finished_at?: string | null
          id: string
          provider?: string
          scope: Json
          started_at?: string
          status: string
          summary?: Json
          trigger: string
        }
        Update: {
          calls?: number
          finished_at?: string | null
          id?: string
          provider?: string
          scope?: Json
          started_at?: string
          status?: string
          summary?: Json
          trigger?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      policy_sync_command: {
        Args: { p_action: string; p_payload: Json }
        Returns: Json
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
    Enums: {},
  },
} as const
