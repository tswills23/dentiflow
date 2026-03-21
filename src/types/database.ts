// DentiFlow Speed-to-Lead — Database Types
// Auto-generated from Supabase schema

export interface Practice {
  id: string;
  name: string;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  timezone: string;
  booking_platform: string;
  booking_url: string | null;
  google_review_link: string | null;
  brand_voice: string;
  twilio_phone: string | null;
  practice_config: PracticeConfig;
  business_hours: BusinessHours;
  appointment_buffer_minutes: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PracticeConfig {
  services_offered?: string[];
  pricing_overrides?: Record<string, PricingOverride>;
  providers?: Provider[];
  tone_notes?: string;
  booking_notes?: string;
  insurance_note?: string;
  new_patient_special?: string;
}

export interface PricingOverride {
  low: number;
  high: number;
  unit: string;
  notes?: string;
}

export interface Provider {
  name: string;
  title: string;
  specialties: string[];
}

export interface BusinessHours {
  monday: DayHours | null;
  tuesday: DayHours | null;
  wednesday: DayHours | null;
  thursday: DayHours | null;
  friday: DayHours | null;
  saturday: DayHours | null;
  sunday: DayHours | null;
}

export interface DayHours {
  open: string;
  close: string;
}

export type PatientStatus = 'new' | 'contacted' | 'nurturing' | 'booked' | 'no_show' | 'completed' | 'inactive';
export type PatientType = 'new_patient' | 'existing_patient' | 'unknown';
export type PatientSource = 'web_form' | 'sms' | 'missed_call' | 'email' | 'chat' | 'manual' | 'google_ads' | 'referral';

export interface Patient {
  id: string;
  practice_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  source: PatientSource;
  status: PatientStatus;
  interested_service: string | null;
  patient_type: PatientType;
  last_visit_date: string | null;
  lead_score: number;
  tags: string[];
  metadata: Record<string, unknown>;
  notes: string | null;
  location: string | null;
  // Recall fields
  recall_eligible: boolean;
  recall_opt_out: boolean;
  recall_voice: string | null;
  recall_segment: string | null;
  created_at: string;
  updated_at: string;
}

export type Channel = 'sms' | 'email' | 'web_form' | 'chat' | 'phone';
export type Direction = 'inbound' | 'outbound';
export type AutomationType = 'speed_to_lead' | 'nurture' | 'reminder' | 'recall' | 'review_request' | null;

export interface Conversation {
  id: string;
  practice_id: string;
  patient_id: string;
  channel: Channel;
  direction: Direction;
  message_body: string;
  service_context: string | null;
  ai_generated: boolean;
  automation_type: AutomationType;
  status: string;
  twilio_sid: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'no_show' | 'cancelled' | 'rescheduled';
export type AppointmentSource = 'ai_booked' | 'manual' | 'booking_link' | 'phone';

export interface Appointment {
  id: string;
  practice_id: string;
  patient_id: string;
  service_id: string;
  provider_name: string | null;
  appointment_time: string;
  duration_minutes: number;
  status: AppointmentStatus;
  source: AppointmentSource | null;
  booking_platform_id: string | null;
  estimated_revenue: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetricsDaily {
  id: string;
  practice_id: string;
  date: string;
  new_leads: number;
  leads_contacted: number;
  appointments_booked: number;
  messages_sent: number;
  avg_response_time_ms: number;
  total_responses: number;
  under_60s_count: number;
  estimated_revenue_recovered: number;
  // Recall metrics
  recall_sent: number;
  recall_replies: number;
  recall_booked: number;
  recall_opt_outs: number;
  created_at: string;
}

export type AutomationResult = 'triggered' | 'sent' | 'delivered' | 'failed' | 'blocked';

export interface AutomationLog {
  id: string;
  practice_id: string;
  patient_id: string | null;
  automation_type: string;
  action: string | null;
  result: AutomationResult;
  response_time_ms: number | null;
  message_body: string | null;
  service_context: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UserProfile {
  id: string;
  auth_user_id: string;
  practice_id: string;
  role: string;
  created_at: string;
}

// Recall sequence row type (inline to avoid import() in Database map)
export interface RecallSequenceRow {
  id: string;
  practice_id: string;
  patient_id: string;
  assigned_voice: string;
  segment_overdue: string;
  months_overdue: number;
  sequence_day: number;
  sequence_status: string;
  booking_stage: string;
  next_send_at: string | null;
  last_sent_at: string | null;
  template_id: string | null;
  offered_slots: unknown | null;
  selected_slot: unknown | null;
  patient_preferences: unknown | null;
  opt_out: boolean;
  defer_until: string | null;
  exit_reason: string | null;
  reply_count: number;
  created_at: string;
  updated_at: string;
}

// Re-export the typed version for use in recall services
export type { RecallSequence } from './recall';

// Supabase Database type map
export interface Database {
  public: {
    Tables: {
      practices: { Row: Practice; Insert: Partial<Practice> & { name: string }; Update: Partial<Practice> };
      patients: { Row: Patient; Insert: Partial<Patient> & { practice_id: string }; Update: Partial<Patient> };
      conversations: { Row: Conversation; Insert: Partial<Conversation> & { practice_id: string; patient_id: string; channel: Channel; direction: Direction; message_body: string }; Update: Partial<Conversation> };
      appointments: { Row: Appointment; Insert: Partial<Appointment> & { practice_id: string; patient_id: string; service_id: string; appointment_time: string }; Update: Partial<Appointment> };
      metrics_daily: { Row: MetricsDaily; Insert: Partial<MetricsDaily> & { practice_id: string; date: string }; Update: Partial<MetricsDaily> };
      automation_log: { Row: AutomationLog; Insert: Partial<AutomationLog> & { practice_id: string; automation_type: string }; Update: Partial<AutomationLog> };
      user_profiles: { Row: UserProfile; Insert: Partial<UserProfile> & { auth_user_id: string; practice_id: string }; Update: Partial<UserProfile> };
      recall_sequences: { Row: RecallSequenceRow; Insert: Partial<RecallSequenceRow> & { practice_id: string; patient_id: string; assigned_voice: string; segment_overdue: string }; Update: Partial<RecallSequenceRow> };
    };
    Functions: {
      increment_metric: { Args: { p_practice_id: string; p_date: string; p_field: string }; Returns: void };
      increment_recall_metric: { Args: { p_practice_id: string; p_date: string; p_field: string }; Returns: void };
    };
  };
}
