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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          participant_a: string
          participant_b: string
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          participant_a: string
          participant_b: string
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          participant_a?: string
          participant_b?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_participant_a_fkey"
            columns: ["participant_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_b_fkey"
            columns: ["participant_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packages: {
        Row: {
          created_at: string
          credits: number
          id: string
          is_active: boolean
          name: string
          price_eur: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits: number
          id?: string
          is_active?: boolean
          name: string
          price_eur: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number
          id?: string
          is_active?: boolean
          name?: string
          price_eur?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      credit_refund_requests: {
        Row: {
          created_at: string
          details: string
          id: string
          reason: Database["public"]["Enums"]["refund_reason"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["refund_status"]
          unlock_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string
          id?: string
          reason: Database["public"]["Enums"]["refund_reason"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          unlock_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          reason?: Database["public"]["Enums"]["refund_reason"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          unlock_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_refund_requests_unlock_id_fkey"
            columns: ["unlock_id"]
            isOneToOne: true
            referencedRelation: "task_unlocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_refund_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string
          id: string
          package_id: string | null
          task_id: string | null
          type: Database["public"]["Enums"]["credit_transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description?: string
          id?: string
          package_id?: string | null
          task_id?: string | null
          type: Database["public"]["Enums"]["credit_transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string
          id?: string
          package_id?: string | null
          task_id?: string | null
          type?: Database["public"]["Enums"]["credit_transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "credit_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string
          id: string
          read_at: string | null
          receiver_id: string
          sender_id: string
          task_id: string | null
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
          task_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_contacts: {
        Row: {
          created_at: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          balance: number
          city: string | null
          created_at: string
          credits: number
          free_tasks_reset_at: string
          free_tasks_used_this_month: number
          full_name: string | null
          id: string
          neighborhood: string | null
        }
        Insert: {
          avatar_url?: string | null
          balance?: number
          city?: string | null
          created_at?: string
          credits?: number
          free_tasks_reset_at?: string
          free_tasks_used_this_month?: number
          full_name?: string | null
          id: string
          neighborhood?: string | null
        }
        Update: {
          avatar_url?: string | null
          balance?: number
          city?: string | null
          created_at?: string
          credits?: number
          free_tasks_reset_at?: string
          free_tasks_used_this_month?: number
          full_name?: string | null
          id?: string
          neighborhood?: string | null
        }
        Relationships: []
      }
      task_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          sort_order: number
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          sort_order?: number
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          sort_order?: number
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_images_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_unlocks: {
        Row: {
          credits_spent: number
          expires_at: string
          id: string
          task_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          credits_spent: number
          expires_at?: string
          id?: string
          task_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          credits_spent?: number
          expires_at?: string
          id?: string
          task_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_unlocks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_unlocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          budget: number
          category: string
          city: string | null
          created_at: string
          currency: string
          description: string
          expires_at: string
          id: string
          neighborhood: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          unlock_cost: number | null
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          budget?: number
          category: string
          city?: string | null
          created_at?: string
          currency?: string
          description?: string
          expires_at?: string
          id?: string
          neighborhood?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          unlock_cost?: number | null
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          budget?: number
          category?: string
          city?: string | null
          created_at?: string
          currency?: string
          description?: string
          expires_at?: string
          id?: string
          neighborhood?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          unlock_cost?: number | null
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "tasks_user_id_fkey"
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
      find_or_create_conversation: {
        Args: { _other_user: string; _task_id: string }
        Returns: string
      }
      get_unlock_cost: { Args: { task_budget: number }; Returns: number }
      mask_contacts: { Args: { input: string }; Returns: string }
      unlock_task_contact: { Args: { _task_id: string }; Returns: Json }
    }
    Enums: {
      credit_transaction_type:
        | "purchase"
        | "unlock"
        | "refund"
        | "bonus"
        | "promo_spend"
      refund_reason:
        | "fake_task"
        | "already_taken"
        | "no_response"
        | "wrong_category"
        | "other"
      refund_status: "pending" | "approved" | "rejected"
      task_status: "active" | "pending" | "pending_payment" | "inactive"
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
      credit_transaction_type: [
        "purchase",
        "unlock",
        "refund",
        "bonus",
        "promo_spend",
      ],
      refund_reason: [
        "fake_task",
        "already_taken",
        "no_response",
        "wrong_category",
        "other",
      ],
      refund_status: ["pending", "approved", "rejected"],
      task_status: ["active", "pending", "pending_payment", "inactive"],
    },
  },
} as const
