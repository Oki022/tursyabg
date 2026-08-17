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
      admin_actions: {
        Row: {
          action_type: string
          admin_id: string | null
          created_at: string
          details: Json
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action_type: string
          admin_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action_type?: string
          admin_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
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
          admin_note: string
          auto_rule: string | null
          created_at: string
          details: string
          id: string
          reason: Database["public"]["Enums"]["refund_reason"]
          resolution: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["refund_status"]
          unlock_id: string
          user_id: string
        }
        Insert: {
          admin_note?: string
          auto_rule?: string | null
          created_at?: string
          details?: string
          id?: string
          reason: Database["public"]["Enums"]["refund_reason"]
          resolution?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          unlock_id: string
          user_id: string
        }
        Update: {
          admin_note?: string
          auto_rule?: string | null
          created_at?: string
          details?: string
          id?: string
          reason?: Database["public"]["Enums"]["refund_reason"]
          resolution?: string
          resolved_at?: string | null
          resolved_by?: string | null
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
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          task_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          task_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          task_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          event_id: string
          event_type: string
          id: string
          payment_id: string | null
          processed_at: string
          provider: string
        }
        Insert: {
          event_id: string
          event_type: string
          id?: string
          payment_id?: string | null
          processed_at?: string
          provider?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          id?: string
          payment_id?: string | null
          processed_at?: string
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_eur: number
          completed_at: string | null
          created_at: string
          credits: number
          currency: string
          id: string
          kind: string
          package_id: string | null
          promo_product_id: string | null
          provider: string
          receipt_url: string | null
          refunded_at: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          task_id: string | null
          user_id: string
        }
        Insert: {
          amount_eur: number
          completed_at?: string | null
          created_at?: string
          credits?: number
          currency?: string
          id?: string
          kind?: string
          package_id?: string | null
          promo_product_id?: string | null
          provider?: string
          receipt_url?: string | null
          refunded_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          task_id?: string | null
          user_id: string
        }
        Update: {
          amount_eur?: number
          completed_at?: string | null
          created_at?: string
          credits?: number
          currency?: string
          id?: string
          kind?: string
          package_id?: string | null
          promo_product_id?: string | null
          provider?: string
          receipt_url?: string | null
          refunded_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "credit_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_promo_product_id_fkey"
            columns: ["promo_product_id"]
            isOneToOne: false
            referencedRelation: "promo_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_task_id_fkey"
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
          ban_reason: string | null
          banned_at: string | null
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
          ban_reason?: string | null
          banned_at?: string | null
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
          ban_reason?: string | null
          banned_at?: string | null
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
      promo_products: {
        Row: {
          code: string
          created_at: string
          duration_days: number
          id: string
          is_active: boolean
          name_bg: string
          price_eur: number
          sort_order: number
          type: Database["public"]["Enums"]["promo_type"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          name_bg: string
          price_eur: number
          sort_order?: number
          type: Database["public"]["Enums"]["promo_type"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          name_bg?: string
          price_eur?: number
          sort_order?: number
          type?: Database["public"]["Enums"]["promo_type"]
          updated_at?: string
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
      task_promotions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          price_paid_eur: number
          promo_product_id: string | null
          starts_at: string
          task_id: string
          type: Database["public"]["Enums"]["promo_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          price_paid_eur?: number
          promo_product_id?: string | null
          starts_at?: string
          task_id: string
          type: Database["public"]["Enums"]["promo_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          price_paid_eur?: number
          promo_product_id?: string | null
          starts_at?: string
          task_id?: string
          type?: Database["public"]["Enums"]["promo_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_promotions_promo_product_id_fkey"
            columns: ["promo_product_id"]
            isOneToOne: false
            referencedRelation: "promo_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_promotions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_promotions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_reports: {
        Row: {
          created_at: string
          details: string
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
          task_id: string
        }
        Insert: {
          created_at?: string
          details?: string
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
          task_id: string
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_reports_task_id_fkey"
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
          assigned_at: string | null
          budget: number
          bumped_at: string
          category: string
          category_corrected_at: string | null
          city: string | null
          created_at: string
          currency: string
          description: string
          expires_at: string
          freshness_prompt_at: string | null
          id: string
          max_unlocks: number
          neighborhood: string | null
          status: Database["public"]["Enums"]["task_status"]
          status_changed_at: string
          title: string
          unlock_cost: number | null
          unlock_count: number
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          assigned_at?: string | null
          budget?: number
          bumped_at?: string
          category: string
          category_corrected_at?: string | null
          city?: string | null
          created_at?: string
          currency?: string
          description?: string
          expires_at?: string
          freshness_prompt_at?: string | null
          id?: string
          max_unlocks?: number
          neighborhood?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          status_changed_at?: string
          title: string
          unlock_cost?: number | null
          unlock_count?: number
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          assigned_at?: string | null
          budget?: number
          bumped_at?: string
          category?: string
          category_corrected_at?: string | null
          city?: string | null
          created_at?: string
          currency?: string
          description?: string
          expires_at?: string
          freshness_prompt_at?: string | null
          id?: string
          max_unlocks?: number
          neighborhood?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          status_changed_at?: string
          title?: string
          unlock_cost?: number | null
          unlock_count?: number
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_credits: {
        Args: { _amount: number; _reason: string; _user_id: string }
        Returns: Json
      }
      admin_correct_task_category: {
        Args: { _category: string; _task_id: string }
        Returns: Json
      }
      admin_daily_series: {
        Args: never
        Returns: {
          day: string
          signups: number
          tasks: number
        }[]
      }
      admin_dashboard_stats: { Args: never; Returns: Json }
      admin_delete_task:
        | { Args: { _reason: string; _task_id: string }; Returns: Json }
        | {
            Args: { _fraudulent?: boolean; _reason: string; _task_id: string }
            Returns: Json
          }
      admin_list_users: {
        Args: { _limit?: number; _search: string }
        Returns: {
          ban_reason: string
          banned_at: string
          created_at: string
          credits: number
          email: string
          full_name: string
          id: string
          is_admin: boolean
          is_moderator: boolean
          refund_count: number
          refund_flagged: boolean
          task_count: number
          total_paid_eur: number
          total_spent_credits: number
          unlock_count: number
        }[]
      }
      admin_refund_evidence: { Args: { _request_id: string }; Returns: Json }
      admin_resolve_refund: {
        Args: { _approve: boolean; _note: string; _request_id: string }
        Returns: Json
      }
      admin_set_ban: {
        Args: { _banned: boolean; _reason: string; _user_id: string }
        Returns: Json
      }
      admin_set_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: Json
      }
      can_bump_task: { Args: { _task_id: string }; Returns: boolean }
      close_task: { Args: { _task_id: string }; Returns: Json }
      complete_payment: {
        Args: {
          _payment_intent: string
          _receipt_url: string
          _session_id: string
        }
        Returns: Json
      }
      complete_promotion_payment: {
        Args: {
          _payment_intent: string
          _receipt_url: string
          _session_id: string
        }
        Returns: Json
      }
      confirm_task_active: { Args: { _task_id: string }; Returns: Json }
      evaluate_refund_rule: {
        Args: {
          _reason: Database["public"]["Enums"]["refund_reason"]
          _unlock_id: string
        }
        Returns: string
      }
      feed_tasks: {
        Args: {
          _category?: string
          _city?: string
          _cursor?: string
          _limit?: number
          _neighborhood?: string
          _promo_offset?: number
          _q?: string
          _seed?: string
        }
        Returns: {
          author: string
          budget: number
          bumped_at: string
          category: string
          city: string
          created_at: string
          description: string
          id: string
          images: string[]
          is_top: boolean
          is_urgent: boolean
          max_unlocks: number
          neighborhood: string
          promo_expires_at: string
          promoted_slot: boolean
          status: Database["public"]["Enums"]["task_status"]
          title: string
          unlock_cost: number
          unlock_count: number
          user_id: string
        }[]
      }
      find_or_create_conversation: {
        Args: { _other_user: string; _task_id: string }
        Returns: string
      }
      get_unlock_cost: { Args: { task_budget: number }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_refund_flagged: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_valid_bg_phone: { Args: { _phone: string }; Returns: boolean }
      log_admin_action: {
        Args: {
          _action_type: string
          _details: Json
          _target_id: string
          _target_type: string
        }
        Returns: undefined
      }
      mask_contacts: { Args: { input: string }; Returns: string }
      push_notification: {
        Args: {
          _body: string
          _link: string
          _task_id: string
          _title: string
          _type: Database["public"]["Enums"]["notification_type"]
          _user_id: string
        }
        Returns: string
      }
      refund_payment: {
        Args: { _payment_intent: string; _status: string }
        Returns: Json
      }
      request_credit_refund: {
        Args: {
          _details: string
          _reason: Database["public"]["Enums"]["refund_reason"]
          _unlock_id: string
        }
        Returns: Json
      }
      settle_refund: {
        Args: {
          _approve: boolean
          _auto: boolean
          _note: string
          _request_id: string
          _rule: string
        }
        Returns: Json
      }
      sweep_expiry_notifications: { Args: never; Returns: undefined }
      unlock_task_contact: { Args: { _task_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "user" | "moderator" | "admin"
      credit_transaction_type:
        | "purchase"
        | "unlock"
        | "refund"
        | "bonus"
        | "promo_spend"
      notification_type:
        | "new_message"
        | "contact_unlocked"
        | "task_expiring"
        | "task_expired"
        | "promo_expiring"
        | "credits_low"
        | "refund_approved"
        | "refund_rejected"
        | "task_reported"
        | "task_still_open"
        | "task_freshness"
        | "refund_auto_approved"
      promo_type: "bump" | "urgent" | "top"
      refund_reason:
        | "fake_task"
        | "already_taken"
        | "no_response"
        | "wrong_category"
        | "other"
      refund_status: "pending" | "approved" | "rejected"
      report_reason:
        | "spam"
        | "fraud"
        | "inappropriate"
        | "wrong_category"
        | "duplicate"
        | "other"
      report_status: "pending" | "reviewed" | "dismissed"
      task_status:
        | "active"
        | "pending"
        | "pending_payment"
        | "inactive"
        | "assigned"
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
      app_role: ["user", "moderator", "admin"],
      credit_transaction_type: [
        "purchase",
        "unlock",
        "refund",
        "bonus",
        "promo_spend",
      ],
      notification_type: [
        "new_message",
        "contact_unlocked",
        "task_expiring",
        "task_expired",
        "promo_expiring",
        "credits_low",
        "refund_approved",
        "refund_rejected",
        "task_reported",
        "task_still_open",
        "task_freshness",
        "refund_auto_approved",
      ],
      promo_type: ["bump", "urgent", "top"],
      refund_reason: [
        "fake_task",
        "already_taken",
        "no_response",
        "wrong_category",
        "other",
      ],
      refund_status: ["pending", "approved", "rejected"],
      report_reason: [
        "spam",
        "fraud",
        "inappropriate",
        "wrong_category",
        "duplicate",
        "other",
      ],
      report_status: ["pending", "reviewed", "dismissed"],
      task_status: [
        "active",
        "pending",
        "pending_payment",
        "inactive",
        "assigned",
      ],
    },
  },
} as const
