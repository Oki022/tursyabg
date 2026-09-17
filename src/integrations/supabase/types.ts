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
      account_deletion_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          requested_at: string
          scheduled_for: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          requested_at?: string
          scheduled_for: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          requested_at?: string
          scheduled_for?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      app_settings: {
        Row: {
          description: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          admin_note: string
          body: string
          created_at: string
          email: string
          handled_by: string | null
          id: string
          name: string
          notified_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_note?: string
          body: string
          created_at?: string
          email: string
          handled_by?: string | null
          id?: string
          name: string
          notified_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_note?: string
          body?: string
          created_at?: string
          email?: string
          handled_by?: string | null
          id?: string
          name?: string
          notified_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_violations: {
        Row: {
          action_taken: string
          auto_detected: boolean
          content_id: string | null
          content_type: string
          created_at: string
          id: string
          reverted_at: string | null
          severity: string
          user_id: string
          violation_type: string
        }
        Insert: {
          action_taken?: string
          auto_detected?: boolean
          content_id?: string | null
          content_type: string
          created_at?: string
          id?: string
          reverted_at?: string | null
          severity?: string
          user_id: string
          violation_type: string
        }
        Update: {
          action_taken?: string
          auto_detected?: boolean
          content_id?: string | null
          content_type?: string
          created_at?: string
          id?: string
          reverted_at?: string | null
          severity?: string
          user_id?: string
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_violations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      cron_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          job_name: string
          rows_processed: number
          started_at: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name: string
          rows_processed?: number
          started_at?: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name?: string
          rows_processed?: number
          started_at?: string
        }
        Relationships: []
      }
      cron_secrets: {
        Row: {
          created_at: string
          name: string
          token: string
        }
        Insert: {
          created_at?: string
          name: string
          token?: string
        }
        Update: {
          created_at?: string
          name?: string
          token?: string
        }
        Relationships: []
      }
      engagements: {
        Row: {
          claimed_at: string
          client_id: string
          confirmed_at: string | null
          created_at: string
          id: string
          professional_id: string
          reminded_at: string | null
          review_deadline: string | null
          status: Database["public"]["Enums"]["engagement_status"]
          task_id: string
        }
        Insert: {
          claimed_at?: string
          client_id: string
          confirmed_at?: string | null
          created_at?: string
          id?: string
          professional_id: string
          reminded_at?: string | null
          review_deadline?: string | null
          status?: Database["public"]["Enums"]["engagement_status"]
          task_id: string
        }
        Update: {
          claimed_at?: string
          client_id?: string
          confirmed_at?: string | null
          created_at?: string
          id?: string
          professional_id?: string
          reminded_at?: string | null
          review_deadline?: string | null
          status?: Database["public"]["Enums"]["engagement_status"]
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      favourites: {
        Row: {
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favourites_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favourites_user_id_fkey"
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
      moderation_items: {
        Row: {
          category: string
          content_id: string | null
          content_type: string
          created_at: string
          details: Json
          excerpt: string
          id: string
          kind: string
          matched_pattern: string | null
          reason: string
          reporter_id: string | null
          resolution_reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          task_id: string | null
          user_id: string | null
        }
        Insert: {
          category?: string
          content_id?: string | null
          content_type: string
          created_at?: string
          details?: Json
          excerpt?: string
          id?: string
          kind: string
          matched_pattern?: string | null
          reason?: string
          reporter_id?: string | null
          resolution_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          task_id?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          content_id?: string | null
          content_type?: string
          created_at?: string
          details?: Json
          excerpt?: string
          id?: string
          kind?: string
          matched_pattern?: string | null
          reason?: string
          reporter_id?: string | null
          resolution_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          task_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_items_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_rules: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          lang: string
          note: string
          pattern: string
          severity: string
          updated_at: string
          weight: number
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          lang?: string
          note?: string
          pattern: string
          severity: string
          updated_at?: string
          weight?: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          lang?: string
          note?: string
          pattern?: string
          severity?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      municipalities: {
        Row: {
          created_at: string
          has_neighborhoods: boolean
          id: string
          lat: number | null
          lng: number | null
          name: string
          region_id: string
          slug: string
        }
        Insert: {
          created_at?: string
          has_neighborhoods?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          region_id: string
          slug: string
        }
        Update: {
          created_at?: string
          has_neighborhoods?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          region_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "municipalities_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhoods: {
        Row: {
          created_at: string
          id: string
          municipality_id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          municipality_id: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          municipality_id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "neighborhoods_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          credits: boolean
          messages: boolean
          moderation: boolean
          promotions: boolean
          reviews: boolean
          tasks: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: boolean
          messages?: boolean
          moderation?: boolean
          promotions?: boolean
          reviews?: boolean
          tasks?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: boolean
          messages?: boolean
          moderation?: boolean
          promotions?: boolean
          reviews?: boolean
          tasks?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
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
      phone_verification_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_verification_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_verification_locks: {
        Row: {
          failed_attempts: number
          locked_until: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          failed_attempts?: number
          locked_until?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          failed_attempts?: number
          locked_until?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
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
          anonymized_at: string | null
          avatar_url: string | null
          balance: number
          ban_reason: string | null
          banned_at: string | null
          city: string | null
          completed_jobs: number
          created_at: string
          credentials: Json
          credits: number
          deactivated_at: string | null
          free_tasks_reset_at: string
          free_tasks_used_this_month: number
          full_name: string | null
          id: string
          neighborhood: string | null
          phone_verified_at: string | null
          rating_as_client: number | null
          rating_as_pro: number | null
          review_count_as_client: number
          review_count_as_pro: number
          skill_categories: string[]
          skill_tags: string[]
          suspended_until: string | null
          trust_level: number
          welcome_bonus_granted_at: string | null
        }
        Insert: {
          anonymized_at?: string | null
          avatar_url?: string | null
          balance?: number
          ban_reason?: string | null
          banned_at?: string | null
          city?: string | null
          completed_jobs?: number
          created_at?: string
          credentials?: Json
          credits?: number
          deactivated_at?: string | null
          free_tasks_reset_at?: string
          free_tasks_used_this_month?: number
          full_name?: string | null
          id: string
          neighborhood?: string | null
          phone_verified_at?: string | null
          rating_as_client?: number | null
          rating_as_pro?: number | null
          review_count_as_client?: number
          review_count_as_pro?: number
          skill_categories?: string[]
          skill_tags?: string[]
          suspended_until?: string | null
          trust_level?: number
          welcome_bonus_granted_at?: string | null
        }
        Update: {
          anonymized_at?: string | null
          avatar_url?: string | null
          balance?: number
          ban_reason?: string | null
          banned_at?: string | null
          city?: string | null
          completed_jobs?: number
          created_at?: string
          credentials?: Json
          credits?: number
          deactivated_at?: string | null
          free_tasks_reset_at?: string
          free_tasks_used_this_month?: number
          full_name?: string | null
          id?: string
          neighborhood?: string | null
          phone_verified_at?: string | null
          rating_as_client?: number | null
          rating_as_pro?: number | null
          review_count_as_client?: number
          review_count_as_pro?: number
          skill_categories?: string[]
          skill_tags?: string[]
          suspended_until?: string | null
          trust_level?: number
          welcome_bonus_granted_at?: string | null
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
      rate_limit_hits: {
        Row: {
          bucket: string
          created_at: string
          id: number
          subject: string
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: never
          subject: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: never
          subject?: string
        }
        Relationships: []
      }
      regions: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      review_reports: {
        Row: {
          created_at: string
          details: string
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          review_id: string
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          created_at?: string
          details?: string
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          review_id: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string
          review_id?: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "review_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string
          created_at: string
          direction: Database["public"]["Enums"]["review_direction"]
          engagement_id: string
          hidden_at: string | null
          hidden_reason: string | null
          id: string
          is_visible: boolean
          rating: number
          reviewee_id: string
          reviewer_id: string
          task_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          direction: Database["public"]["Enums"]["review_direction"]
          engagement_id: string
          hidden_at?: string | null
          hidden_reason?: string | null
          id?: string
          is_visible?: boolean
          rating: number
          reviewee_id: string
          reviewer_id: string
          task_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["review_direction"]
          engagement_id?: string
          hidden_at?: string | null
          hidden_reason?: string | null
          id?: string
          is_visible?: boolean
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_history: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          moderation_labels: Json
          moderation_provider: string | null
          moderation_score: number | null
          moderation_status: string
          sort_order: number
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          moderation_labels?: Json
          moderation_provider?: string | null
          moderation_score?: number | null
          moderation_status?: string
          sort_order?: number
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          moderation_labels?: Json
          moderation_provider?: string | null
          moderation_score?: number | null
          moderation_status?: string
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
          admin_hidden_at: string | null
          assigned_at: string | null
          budget: number
          bumped_at: string
          category: string
          category_corrected_at: string | null
          city: string | null
          content_edited_at: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          deleted_reason: string | null
          description: string
          expires_at: string
          freshness_prompt_at: string | null
          id: string
          max_unlocks: number
          municipality_id: string | null
          neighborhood: string | null
          region_id: string | null
          reposted_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          status_before_deactivation:
            | Database["public"]["Enums"]["task_status"]
            | null
          status_changed_at: string
          title: string
          unlock_cost: number | null
          unlock_count: number
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          admin_hidden_at?: string | null
          assigned_at?: string | null
          budget?: number
          bumped_at?: string
          category: string
          category_corrected_at?: string | null
          city?: string | null
          content_edited_at?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deleted_reason?: string | null
          description?: string
          expires_at?: string
          freshness_prompt_at?: string | null
          id?: string
          max_unlocks?: number
          municipality_id?: string | null
          neighborhood?: string | null
          region_id?: string | null
          reposted_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          status_before_deactivation?:
            | Database["public"]["Enums"]["task_status"]
            | null
          status_changed_at?: string
          title: string
          unlock_cost?: number | null
          unlock_count?: number
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          admin_hidden_at?: string | null
          assigned_at?: string | null
          budget?: number
          bumped_at?: string
          category?: string
          category_corrected_at?: string | null
          city?: string | null
          content_edited_at?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deleted_reason?: string | null
          description?: string
          expires_at?: string
          freshness_prompt_at?: string | null
          id?: string
          max_unlocks?: number
          municipality_id?: string | null
          neighborhood?: string | null
          region_id?: string | null
          reposted_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          status_before_deactivation?:
            | Database["public"]["Enums"]["task_status"]
            | null
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
            foreignKeyName: "tasks_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unconfirmed_account_notices: {
        Row: {
          created_at: string
          day25_sent_at: string | null
          day7_sent_at: string | null
          deleted_at: string | null
          email: string
          flag_reason: string
          flagged_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          day25_sent_at?: string | null
          day7_sent_at?: string | null
          deleted_at?: string | null
          email?: string
          flag_reason?: string
          flagged_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          day25_sent_at?: string | null
          day7_sent_at?: string | null
          deleted_at?: string | null
          email?: string
          flag_reason?: string
          flagged_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      admin_contact_sender: {
        Args: { _email: string; _user_id: string }
        Returns: Json
      }
      admin_correct_task_category: {
        Args: { _category: string; _task_id: string }
        Returns: Json
      }
      admin_credit_mismatches: {
        Args: never
        Returns: {
          credits: number
          diff: number
          full_name: string
          ledger: number
          user_id: string
        }[]
      }
      admin_cron_health: {
        Args: never
        Returns: {
          job_name: string
          last_error: string
          last_run: string
          last_success: string
          rows_processed: number
          stale: boolean
        }[]
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
      admin_delete_task: {
        Args: { _fraudulent: boolean; _reason: string; _task_id: string }
        Returns: Json
      }
      admin_hide_review: {
        Args: { _reason: string; _review_id: string }
        Returns: Json
      }
      admin_list_deletion_requests: {
        Args: { _status?: string }
        Returns: {
          completed_at: string
          full_name: string
          id: string
          requested_at: string
          scheduled_for: string
          status: string
          user_id: string
        }[]
      }
      admin_list_refunds: {
        Args: { _status?: string }
        Returns: {
          admin_note: string
          auto_rule: string
          created_at: string
          credits: number
          details: string
          id: string
          reason: Database["public"]["Enums"]["refund_reason"]
          resolution: string
          resolved_at: string
          status: Database["public"]["Enums"]["refund_status"]
          task_id: string
          task_title: string
          user_id: string
          user_name: string
        }[]
      }
      admin_list_reviews: {
        Args: { _filter?: string; _limit?: number }
        Returns: {
          comment: string
          created_at: string
          direction: Database["public"]["Enums"]["review_direction"]
          hidden_at: string
          hidden_reason: string
          id: string
          is_visible: boolean
          rating: number
          report_count: number
          reviewee_id: string
          reviewee_name: string
          reviewer_id: string
          reviewer_name: string
          task_id: string
          task_title: string
        }[]
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
      admin_moderation_queue: {
        Args: { _limit?: number; _status?: string }
        Returns: {
          account_age_days: number
          category: string
          content_id: string
          content_type: string
          created_at: string
          details: Json
          excerpt: string
          id: string
          image_path: string
          kind: string
          matched_pattern: string
          moderation_labels: Json
          moderation_score: number
          prior_violations: number
          reason: string
          reporter_id: string
          reporter_name: string
          severity: string
          status: string
          task_id: string
          task_title: string
          trust_level: number
          user_id: string
          user_name: string
        }[]
      }
      admin_refund_evidence: { Args: { _request_id: string }; Returns: Json }
      admin_resolve_moderation: {
        Args: { _approve: boolean; _item_id: string; _reason: string }
        Returns: Json
      }
      admin_resolve_refund: {
        Args: { _approve: boolean; _note: string; _request_id: string }
        Returns: Json
      }
      admin_review_flags: { Args: never; Returns: Json }
      admin_set_ban: {
        Args: { _banned: boolean; _reason: string; _user_id: string }
        Returns: Json
      }
      admin_set_contact_status: {
        Args: { _id: string; _note?: string; _status: string }
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
      admin_set_task_active: {
        Args: { _active: boolean; _reason: string; _task_id: string }
        Returns: Json
      }
      admin_task_delete_preview: { Args: { _task_id: string }; Returns: Json }
      anonymize_account: { Args: { _uid: string }; Returns: undefined }
      app_setting_bool: {
        Args: { _default: boolean; _key: string }
        Returns: boolean
      }
      app_setting_int: {
        Args: { _default: number; _key: string }
        Returns: number
      }
      assign_engagement: {
        Args: { _professional_id: string; _task_id: string }
        Returns: Json
      }
      ban_user_cascade: {
        Args: { _reason: string; _user_id: string }
        Returns: Json
      }
      bg_slug: { Args: { _input: string }; Returns: string }
      call_unconfirmed_reminders: { Args: never; Returns: undefined }
      can_bump_task: { Args: { _task_id: string }; Returns: boolean }
      can_repost_task: { Args: { _source_task_id: string }; Returns: Json }
      cancel_account_deletion: { Args: never; Returns: undefined }
      claim_engagement: { Args: { _task_id: string }; Returns: Json }
      close_task: {
        Args: { _outcome?: string; _task_id: string }
        Returns: Json
      }
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
      confirm_phone_verification: {
        Args: { _code_hash: string; _user_id: string }
        Returns: Json
      }
      confirm_task_active: { Args: { _task_id: string }; Returns: Json }
      copy_task_images: {
        Args: {
          _exclude_ids?: string[]
          _new_task_id: string
          _source_task_id: string
        }
        Returns: number
      }
      deactivate_own_account: { Args: never; Returns: undefined }
      delete_own_task: {
        Args: { _reason: string; _task_id: string }
        Returns: Json
      }
      detect_service_ad: { Args: { _text: string }; Returns: Json }
      enforce_rate_limit: {
        Args: {
          _bucket: string
          _limit: number
          _subject: string
          _window: string
        }
        Returns: undefined
      }
      enqueue_moderation: {
        Args: {
          _category: string
          _content_id: string
          _content_type: string
          _details: Json
          _excerpt: string
          _kind: string
          _pattern: string
          _reason: string
          _severity: string
          _task_id: string
          _user_id: string
        }
        Returns: string
      }
      export_my_data: { Args: never; Returns: Json }
      feed_tasks: {
        Args: {
          _category?: string
          _city?: string
          _cursor?: string
          _limit?: number
          _neighborhood?: string
          _promo_offset?: number
          _q?: string
          _region?: string
          _seed?: string
        }
        Returns: {
          author: string
          author_rating: number
          author_review_count: number
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
      finalize_task_publication: { Args: { _task_id: string }; Returns: Json }
      find_or_create_conversation: {
        Args: { _other_user: string; _task_id: string }
        Returns: string
      }
      flag_low_quality_tasks: { Args: never; Returns: number }
      get_unlock_cost: { Args: { task_budget: number }; Returns: number }
      grant_welcome_bonus: { Args: { _user_id: string }; Returns: number }
      guard_auth_attempt: {
        Args: { _action: string; _email: string; _ip: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_gibberish: { Args: { _text: string }; Returns: boolean }
      is_last_admin: { Args: { _user_id: string }; Returns: boolean }
      is_phone_available: { Args: { _phone: string }; Returns: boolean }
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
      mark_task_reposted: {
        Args: { _new_task_id: string; _source_task_id: string }
        Returns: Json
      }
      mark_unconfirmed_reminder: {
        Args: { _email: string; _stage: number; _user_id: string }
        Returns: undefined
      }
      mask_contacts: { Args: { input: string }; Returns: string }
      moderate_text: { Args: { _text: string }; Returns: Json }
      my_account_state: { Args: never; Returns: Json }
      my_engagements: {
        Args: never
        Returns: {
          claimed_at: string
          client_id: string
          client_name: string
          confirmed_at: string
          id: string
          my_review_id: string
          other_submitted: boolean
          professional_id: string
          professional_name: string
          promo_expires_at: string
          review_deadline: string
          status: Database["public"]["Enums"]["engagement_status"]
          task_category: string
          task_id: string
          task_status: Database["public"]["Enums"]["task_status"]
          task_title: string
        }[]
      }
      needs_prepublish_review: { Args: { _user_id: string }; Returns: boolean }
      notification_group: {
        Args: { _type: Database["public"]["Enums"]["notification_type"] }
        Returns: string
      }
      own_task_delete_preview: { Args: { _task_id: string }; Returns: Json }
      popular_skill_tags: {
        Args: { p_categories?: string[]; p_limit?: number }
        Returns: {
          tag: string
          uses: number
        }[]
      }
      profile_has_activity: { Args: { _user_id: string }; Returns: boolean }
      public_profile: { Args: { _user_id: string }; Returns: Json }
      public_profiles: {
        Args: { _ids: string[] }
        Returns: {
          avatar_url: string
          city: string
          completed_jobs: number
          created_at: string
          full_name: string
          has_activity: boolean
          id: string
          neighborhood: string
          rating_as_client: number
          rating_as_pro: number
          review_count_as_client: number
          review_count_as_pro: number
          skill_categories: string[]
          skill_tags: string[]
        }[]
      }
      public_reviews: {
        Args: {
          _direction: Database["public"]["Enums"]["review_direction"]
          _limit?: number
          _offset?: number
          _user_id: string
        }
        Returns: {
          category: string
          comment: string
          created_at: string
          id: string
          rating: number
          reviewer_id: string
          reviewer_name: string
        }[]
      }
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
      reactivate_own_account: { Args: never; Returns: undefined }
      recompute_review_aggregates: {
        Args: { _user_id: string }
        Returns: undefined
      }
      record_content_violation: {
        Args: {
          _auto: boolean
          _content_id: string
          _content_type: string
          _severity: string
          _user_id: string
          _violation_type: string
        }
        Returns: Json
      }
      record_image_moderation: {
        Args: {
          _image_id: string
          _labels: Json
          _provider: string
          _score: number
          _status: string
          _unavailable: boolean
        }
        Returns: Json
      }
      refund_payment: {
        Args: { _payment_intent: string; _status: string }
        Returns: Json
      }
      region_municipality_counts: {
        Args: { _category?: string; _region: string }
        Returns: {
          name: string
          slug: string
          task_count: number
        }[]
      }
      report_content: {
        Args: {
          _content_id: string
          _content_type: string
          _details: string
          _reason: string
        }
        Returns: Json
      }
      request_account_deletion: { Args: never; Returns: string }
      respond_engagement: {
        Args: { _confirm: boolean; _engagement_id: string }
        Returns: Json
      }
      reveal_engagement_reviews: {
        Args: { _engagement_id: string }
        Returns: number
      }
      run_cron_job: { Args: { _job_name: string }; Returns: undefined }
      set_my_phone: { Args: { _phone: string }; Returns: Json }
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
      start_phone_verification: {
        Args: { _code_hash: string; _phone: string; _user_id: string }
        Returns: Json
      }
      submit_contact_message: {
        Args: { _body: string; _email: string; _name: string; _subject: string }
        Returns: string
      }
      submit_review: {
        Args: { _comment: string; _engagement_id: string; _rating: number }
        Returns: Json
      }
      suppress_task_lifecycle_notifications: {
        Args: { _task_id: string }
        Returns: undefined
      }
      sweep_account_deletions: { Args: { _limit?: number }; Returns: number }
      sweep_autopublish: { Args: { _limit?: number }; Returns: number }
      sweep_engagements: { Args: { _batch?: number }; Returns: number }
      sweep_expiry_notifications: { Args: { _batch?: number }; Returns: number }
      sweep_unconfirmed_accounts: { Args: { _limit?: number }; Returns: number }
      task_content_issue: {
        Args: { _budget: number; _description: string; _title: string }
        Returns: string
      }
      task_unlockers: {
        Args: { _task_id: string }
        Returns: {
          avatar_url: string
          full_name: string
          has_engagement: boolean
          rating_as_pro: number
          review_count_as_pro: number
          unlocked_at: string
          user_id: string
        }[]
      }
      text_quality_issue: {
        Args: {
          _max_len: number
          _min_len: number
          _min_words: number
          _text: string
        }
        Returns: string
      }
      unconfirmed_reminder_batch: {
        Args: { _limit?: number }
        Returns: {
          email: string
          stage: number
          user_id: string
        }[]
      }
      unlock_task_contact: { Args: { _task_id: string }; Returns: Json }
      update_own_task: {
        Args: {
          _budget: number
          _category: string
          _city: string
          _description: string
          _neighborhood: string
          _task_id: string
          _title: string
        }
        Returns: Json
      }
      user_trust: { Args: { _user_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "user" | "moderator" | "admin"
      credit_transaction_type:
        | "purchase"
        | "unlock"
        | "refund"
        | "bonus"
        | "promo_spend"
      engagement_status: "claimed" | "confirmed" | "rejected" | "expired"
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
        | "engagement_claimed"
        | "engagement_confirmed"
        | "engagement_rejected"
        | "engagement_reminder"
        | "review_requested"
        | "review_reminder"
        | "review_published"
        | "content_rejected"
        | "content_held"
        | "content_approved"
        | "moderation_warning"
        | "account_suspended"
        | "account_banned"
        | "contact_message"
        | "account_deletion_scheduled"
        | "account_deletion_cancelled"
        | "credits_adjusted"
        | "account_restored"
        | "task_removed"
        | "task_category_changed"
        | "review_removed"
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
        | "stale"
      report_status: "pending" | "reviewed" | "dismissed"
      review_direction: "client_to_pro" | "pro_to_client"
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
      app_role: ["user", "moderator", "admin"],
      credit_transaction_type: [
        "purchase",
        "unlock",
        "refund",
        "bonus",
        "promo_spend",
      ],
      engagement_status: ["claimed", "confirmed", "rejected", "expired"],
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
        "engagement_claimed",
        "engagement_confirmed",
        "engagement_rejected",
        "engagement_reminder",
        "review_requested",
        "review_reminder",
        "review_published",
        "content_rejected",
        "content_held",
        "content_approved",
        "moderation_warning",
        "account_suspended",
        "account_banned",
        "contact_message",
        "account_deletion_scheduled",
        "account_deletion_cancelled",
        "credits_adjusted",
        "account_restored",
        "task_removed",
        "task_category_changed",
        "review_removed",
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
        "stale",
      ],
      report_status: ["pending", "reviewed", "dismissed"],
      review_direction: ["client_to_pro", "pro_to_client"],
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
