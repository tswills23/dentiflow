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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_time: string
          booking_platform_id: string | null
          created_at: string | null
          duration_minutes: number | null
          estimated_revenue: number | null
          id: string
          notes: string | null
          patient_id: string
          practice_id: string
          provider_name: string | null
          service_id: string
          source: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_time: string
          booking_platform_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          estimated_revenue?: number | null
          id?: string
          notes?: string | null
          patient_id: string
          practice_id: string
          provider_name?: string | null
          service_id: string
          source?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_time?: string
          booking_platform_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          estimated_revenue?: number | null
          id?: string
          notes?: string | null
          patient_id?: string
          practice_id?: string
          provider_name?: string | null
          service_id?: string
          source?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_log: {
        Row: {
          action: string | null
          automation_type: string
          created_at: string | null
          error_message: string | null
          id: string
          message_body: string | null
          metadata: Json | null
          patient_id: string | null
          practice_id: string
          response_time_ms: number | null
          result: string | null
          service_context: string | null
        }
        Insert: {
          action?: string | null
          automation_type: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_body?: string | null
          metadata?: Json | null
          patient_id?: string | null
          practice_id: string
          response_time_ms?: number | null
          result?: string | null
          service_context?: string | null
        }
        Update: {
          action?: string | null
          automation_type?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_body?: string | null
          metadata?: Json | null
          patient_id?: string | null
          practice_id?: string
          response_time_ms?: number | null
          result?: string | null
          service_context?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_log_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_log_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          interested_treatment: string | null
          last_name: string | null
          last_treatment_id: string | null
          last_visit_date: string | null
          lead_score: number
          metadata: Json | null
          notes: string | null
          phone: string | null
          source: string | null
          spa_id: string
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          interested_treatment?: string | null
          last_name?: string | null
          last_treatment_id?: string | null
          last_visit_date?: string | null
          lead_score?: number
          metadata?: Json | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          spa_id: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          interested_treatment?: string | null
          last_name?: string | null
          last_treatment_id?: string | null
          last_visit_date?: string | null
          lead_score?: number
          metadata?: Json | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          spa_id?: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_spa_id_fkey"
            columns: ["spa_id"]
            isOneToOne: false
            referencedRelation: "spas"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_generated: boolean | null
          automation_type: string | null
          channel: string
          created_at: string | null
          direction: string
          id: string
          message_body: string
          metadata: Json | null
          patient_id: string
          practice_id: string
          service_context: string | null
          status: string | null
          twilio_sid: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          automation_type?: string | null
          channel: string
          created_at?: string | null
          direction: string
          id?: string
          message_body: string
          metadata?: Json | null
          patient_id: string
          practice_id: string
          service_context?: string | null
          status?: string | null
          twilio_sid?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          automation_type?: string | null
          channel?: string
          created_at?: string | null
          direction?: string
          id?: string
          message_body?: string
          metadata?: Json | null
          patient_id?: string
          practice_id?: string
          service_context?: string | null
          status?: string | null
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_daily: {
        Row: {
          appointments_booked: number | null
          avg_response_time_ms: number | null
          created_at: string | null
          date: string
          estimated_revenue_recovered: number | null
          id: string
          leads_contacted: number | null
          messages_sent: number | null
          new_leads: number | null
          noshow_recovered: number | null
          noshow_total: number | null
          pms_events_processed: number | null
          practice_id: string
          recall_booked: number | null
          recall_links_clicked: number | null
          recall_opt_outs: number | null
          recall_replies: number | null
          recall_sent: number | null
          referrals_converted: number | null
          referrals_generated: number | null
          review_links_sent: number | null
          review_scores_received: number | null
          review_surveys_sent: number | null
          total_responses: number | null
          under_60s_count: number | null
        }
        Insert: {
          appointments_booked?: number | null
          avg_response_time_ms?: number | null
          created_at?: string | null
          date: string
          estimated_revenue_recovered?: number | null
          id?: string
          leads_contacted?: number | null
          messages_sent?: number | null
          new_leads?: number | null
          noshow_recovered?: number | null
          noshow_total?: number | null
          pms_events_processed?: number | null
          practice_id: string
          recall_booked?: number | null
          recall_links_clicked?: number | null
          recall_opt_outs?: number | null
          recall_replies?: number | null
          recall_sent?: number | null
          referrals_converted?: number | null
          referrals_generated?: number | null
          review_links_sent?: number | null
          review_scores_received?: number | null
          review_surveys_sent?: number | null
          total_responses?: number | null
          under_60s_count?: number | null
        }
        Update: {
          appointments_booked?: number | null
          avg_response_time_ms?: number | null
          created_at?: string | null
          date?: string
          estimated_revenue_recovered?: number | null
          id?: string
          leads_contacted?: number | null
          messages_sent?: number | null
          new_leads?: number | null
          noshow_recovered?: number | null
          noshow_total?: number | null
          pms_events_processed?: number | null
          practice_id?: string
          recall_booked?: number | null
          recall_links_clicked?: number | null
          recall_opt_outs?: number | null
          recall_replies?: number | null
          recall_sent?: number | null
          referrals_converted?: number | null
          referrals_generated?: number | null
          review_links_sent?: number | null
          review_scores_received?: number | null
          review_surveys_sent?: number | null
          total_responses?: number | null
          under_60s_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metrics_daily_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      noshow_sequences: {
        Row: {
          appointment_id: string | null
          booking_stage: string | null
          created_at: string | null
          defer_until: string | null
          id: string
          last_sent_at: string | null
          message_count: number | null
          next_send_at: string | null
          offered_slots: Json | null
          patient_id: string
          patient_preferences: Json | null
          practice_id: string
          reply_count: number | null
          selected_slot: Json | null
          status: string
          updated_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          booking_stage?: string | null
          created_at?: string | null
          defer_until?: string | null
          id?: string
          last_sent_at?: string | null
          message_count?: number | null
          next_send_at?: string | null
          offered_slots?: Json | null
          patient_id: string
          patient_preferences?: Json | null
          practice_id: string
          reply_count?: number | null
          selected_slot?: Json | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          booking_stage?: string | null
          created_at?: string | null
          defer_until?: string | null
          id?: string
          last_sent_at?: string | null
          message_count?: number | null
          next_send_at?: string | null
          offered_slots?: Json | null
          patient_id?: string
          patient_preferences?: Json | null
          practice_id?: string
          reply_count?: number | null
          selected_slot?: Json | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "noshow_sequences_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "noshow_sequences_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "noshow_sequences_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          interested_service: string | null
          last_name: string | null
          last_visit_date: string | null
          lead_score: number | null
          location: string | null
          metadata: Json | null
          notes: string | null
          patient_type: string | null
          phone: string | null
          pms_patient_id: string | null
          practice_id: string
          recall_eligible: boolean | null
          recall_opt_out: boolean | null
          recall_segment: string | null
          recall_voice: string | null
          source: string | null
          status: string | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          interested_service?: string | null
          last_name?: string | null
          last_visit_date?: string | null
          lead_score?: number | null
          location?: string | null
          metadata?: Json | null
          notes?: string | null
          patient_type?: string | null
          phone?: string | null
          pms_patient_id?: string | null
          practice_id: string
          recall_eligible?: boolean | null
          recall_opt_out?: boolean | null
          recall_segment?: string | null
          recall_voice?: string | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          interested_service?: string | null
          last_name?: string | null
          last_visit_date?: string | null
          lead_score?: number | null
          location?: string | null
          metadata?: Json | null
          notes?: string | null
          patient_type?: string | null
          phone?: string | null
          pms_patient_id?: string | null
          practice_id?: string
          recall_eligible?: boolean | null
          recall_opt_out?: boolean | null
          recall_segment?: string | null
          recall_voice?: string | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      pms_integrations: {
        Row: {
          access_token: string | null
          active: boolean | null
          api_base_url: string | null
          client_id: string | null
          client_secret: string | null
          created_at: string | null
          error_count: number | null
          id: string
          last_error: string | null
          last_synced_at: string | null
          pms_type: string
          polling_enabled: boolean | null
          polling_interval_minutes: number | null
          practice_id: string
          refresh_token: string | null
          sync_cancelled: boolean | null
          sync_complete: boolean | null
          sync_noshow: boolean | null
          sync_rescheduled: boolean | null
          token_expires_at: string | null
          updated_at: string | null
          webhook_api_key: string | null
          webhook_secret: string | null
        }
        Insert: {
          access_token?: string | null
          active?: boolean | null
          api_base_url?: string | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string | null
          error_count?: number | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          pms_type?: string
          polling_enabled?: boolean | null
          polling_interval_minutes?: number | null
          practice_id: string
          refresh_token?: string | null
          sync_cancelled?: boolean | null
          sync_complete?: boolean | null
          sync_noshow?: boolean | null
          sync_rescheduled?: boolean | null
          token_expires_at?: string | null
          updated_at?: string | null
          webhook_api_key?: string | null
          webhook_secret?: string | null
        }
        Update: {
          access_token?: string | null
          active?: boolean | null
          api_base_url?: string | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string | null
          error_count?: number | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          pms_type?: string
          polling_enabled?: boolean | null
          polling_interval_minutes?: number | null
          practice_id?: string
          refresh_token?: string | null
          sync_cancelled?: boolean | null
          sync_complete?: boolean | null
          sync_noshow?: boolean | null
          sync_rescheduled?: boolean | null
          token_expires_at?: string | null
          updated_at?: string | null
          webhook_api_key?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pms_integrations_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      pms_sync_log: {
        Row: {
          action_taken: string | null
          dentiflow_appointment_id: string | null
          dentiflow_patient_id: string | null
          error_message: string | null
          event_type: string
          id: string
          pms_appointment_id: string
          pms_event_id: string
          pms_patient_id: string | null
          practice_id: string
          processed_at: string | null
          source: string
          success: boolean | null
        }
        Insert: {
          action_taken?: string | null
          dentiflow_appointment_id?: string | null
          dentiflow_patient_id?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          pms_appointment_id: string
          pms_event_id: string
          pms_patient_id?: string | null
          practice_id: string
          processed_at?: string | null
          source?: string
          success?: boolean | null
        }
        Update: {
          action_taken?: string | null
          dentiflow_appointment_id?: string | null
          dentiflow_patient_id?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          pms_appointment_id?: string
          pms_event_id?: string
          pms_patient_id?: string | null
          practice_id?: string
          processed_at?: string | null
          source?: string
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "pms_sync_log_dentiflow_appointment_id_fkey"
            columns: ["dentiflow_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pms_sync_log_dentiflow_patient_id_fkey"
            columns: ["dentiflow_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pms_sync_log_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      practices: {
        Row: {
          active: boolean | null
          address: string | null
          appointment_buffer_minutes: number | null
          booking_platform: string | null
          booking_url: string | null
          brand_voice: string | null
          business_hours: Json | null
          city: string | null
          created_at: string | null
          email: string | null
          google_review_link: string | null
          id: string
          name: string
          owner_name: string | null
          phone: string | null
          practice_config: Json | null
          state: string | null
          timezone: string | null
          twilio_phone: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          appointment_buffer_minutes?: number | null
          booking_platform?: string | null
          booking_url?: string | null
          brand_voice?: string | null
          business_hours?: Json | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          google_review_link?: string | null
          id?: string
          name: string
          owner_name?: string | null
          phone?: string | null
          practice_config?: Json | null
          state?: string | null
          timezone?: string | null
          twilio_phone?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          appointment_buffer_minutes?: number | null
          booking_platform?: string | null
          booking_url?: string | null
          brand_voice?: string | null
          business_hours?: Json | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          google_review_link?: string | null
          id?: string
          name?: string
          owner_name?: string | null
          phone?: string | null
          practice_config?: Json | null
          state?: string | null
          timezone?: string | null
          twilio_phone?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      recall_sequences: {
        Row: {
          assigned_voice: string
          booking_link_token: string | null
          booking_stage: string
          created_at: string | null
          defer_until: string | null
          exit_reason: string | null
          id: string
          last_sent_at: string | null
          link_clicked_at: string | null
          link_followup_sent: boolean | null
          months_overdue: number
          next_send_at: string | null
          offered_slots: Json | null
          opt_out: boolean | null
          patient_id: string
          patient_preferences: Json | null
          practice_id: string
          reply_count: number | null
          segment_overdue: string
          selected_slot: Json | null
          sequence_day: number
          sequence_status: string
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_voice: string
          booking_link_token?: string | null
          booking_stage?: string
          created_at?: string | null
          defer_until?: string | null
          exit_reason?: string | null
          id?: string
          last_sent_at?: string | null
          link_clicked_at?: string | null
          link_followup_sent?: boolean | null
          months_overdue?: number
          next_send_at?: string | null
          offered_slots?: Json | null
          opt_out?: boolean | null
          patient_id: string
          patient_preferences?: Json | null
          practice_id: string
          reply_count?: number | null
          segment_overdue: string
          selected_slot?: Json | null
          sequence_day?: number
          sequence_status?: string
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_voice?: string
          booking_link_token?: string | null
          booking_stage?: string
          created_at?: string | null
          defer_until?: string | null
          exit_reason?: string | null
          id?: string
          last_sent_at?: string | null
          link_clicked_at?: string | null
          link_followup_sent?: boolean | null
          months_overdue?: number
          next_send_at?: string | null
          offered_slots?: Json | null
          opt_out?: boolean | null
          patient_id?: string
          patient_preferences?: Json | null
          practice_id?: string
          reply_count?: number | null
          segment_overdue?: string
          selected_slot?: Json | null
          sequence_day?: number
          sequence_status?: string
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recall_sequences_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recall_sequences_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          converted_at: string | null
          created_at: string | null
          id: string
          practice_id: string
          referral_link_hash: string
          referred_name: string | null
          referred_phone: string | null
          referring_patient_id: string
          status: string
        }
        Insert: {
          converted_at?: string | null
          created_at?: string | null
          id?: string
          practice_id: string
          referral_link_hash: string
          referred_name?: string | null
          referred_phone?: string | null
          referring_patient_id: string
          status?: string
        }
        Update: {
          converted_at?: string | null
          created_at?: string | null
          id?: string
          practice_id?: string
          referral_link_hash?: string
          referred_name?: string | null
          referred_phone?: string | null
          referring_patient_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referring_patient_id_fkey"
            columns: ["referring_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      review_feedback: {
        Row: {
          acknowledged: boolean | null
          created_at: string | null
          feedback_text: string
          id: string
          patient_id: string
          practice_id: string
          review_sequence_id: string
          score: number
        }
        Insert: {
          acknowledged?: boolean | null
          created_at?: string | null
          feedback_text: string
          id?: string
          patient_id: string
          practice_id: string
          review_sequence_id: string
          score: number
        }
        Update: {
          acknowledged?: boolean | null
          created_at?: string | null
          feedback_text?: string
          id?: string
          patient_id?: string
          practice_id?: string
          review_sequence_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "review_feedback_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_feedback_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_feedback_review_sequence_id_fkey"
            columns: ["review_sequence_id"]
            isOneToOne: false
            referencedRelation: "review_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      review_sequences: {
        Row: {
          appointment_id: string | null
          created_at: string | null
          id: string
          patient_id: string
          practice_id: string
          referral_sent: boolean | null
          referral_sent_at: string | null
          reminder_sent_at: string | null
          review_requested_at: string | null
          review_url_sent: boolean | null
          satisfaction_score: number | null
          status: string
          survey_send_at: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string | null
          id?: string
          patient_id: string
          practice_id: string
          referral_sent?: boolean | null
          referral_sent_at?: string | null
          reminder_sent_at?: string | null
          review_requested_at?: string | null
          review_url_sent?: boolean | null
          satisfaction_score?: number | null
          status?: string
          survey_send_at?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          created_at?: string | null
          id?: string
          patient_id?: string
          practice_id?: string
          referral_sent?: boolean | null
          referral_sent_at?: string | null
          reminder_sent_at?: string | null
          review_requested_at?: string | null
          review_url_sent?: boolean | null
          satisfaction_score?: number | null
          status?: string
          survey_send_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_sequences_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_sequences_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      spas: {
        Row: {
          active: boolean
          address: string | null
          booking_platform: string | null
          booking_url: string | null
          brand_voice: string | null
          city: string | null
          created_at: string
          email: string | null
          google_review_link: string | null
          id: string
          name: string
          owner_name: string | null
          phone: string | null
          state: string | null
          timezone: string
          twilio_phone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          booking_platform?: string | null
          booking_url?: string | null
          brand_voice?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          google_review_link?: string | null
          id?: string
          name: string
          owner_name?: string | null
          phone?: string | null
          state?: string | null
          timezone?: string
          twilio_phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          booking_platform?: string | null
          booking_url?: string | null
          brand_voice?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          google_review_link?: string | null
          id?: string
          name?: string
          owner_name?: string | null
          phone?: string | null
          state?: string | null
          timezone?: string
          twilio_phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          auth_user_id: string
          created_at: string | null
          id: string
          practice_id: string
          role: string | null
        }
        Insert: {
          auth_user_id: string
          created_at?: string | null
          id?: string
          practice_id: string
          role?: string | null
        }
        Update: {
          auth_user_id?: string
          created_at?: string | null
          id?: string
          practice_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_metric: {
        Args: { p_date: string; p_field: string; p_practice_id: string }
        Returns: undefined
      }
      increment_noshow_metric: {
        Args: { p_date: string; p_field: string; p_practice_id: string }
        Returns: undefined
      }
      increment_recall_metric: {
        Args: { p_date: string; p_field: string; p_practice_id: string }
        Returns: undefined
      }
      increment_review_metric: {
        Args: { p_date: string; p_field: string; p_practice_id: string }
        Returns: undefined
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
