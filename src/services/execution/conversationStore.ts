import { supabase } from '../../lib/supabase';
import type { Conversation, Channel, Direction, AutomationType } from '../../types/database';

export async function saveMessage(params: {
  practiceId: string;
  patientId: string;
  channel: Channel;
  direction: Direction;
  messageBody: string;
  serviceContext?: string;
  aiGenerated?: boolean;
  automationType?: AutomationType;
  twilioSid?: string;
  metadata?: Record<string, unknown>;
}): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      practice_id: params.practiceId,
      patient_id: params.patientId,
      channel: params.channel,
      direction: params.direction,
      message_body: params.messageBody,
      service_context: params.serviceContext || null,
      ai_generated: params.aiGenerated || false,
      automation_type: params.automationType || null,
      twilio_sid: params.twilioSid || null,
      metadata: params.metadata || {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save message: ${error.message}`);
  }

  return data;
}

export async function getConversationHistory(
  patientId: string,
  limit: number = 10
): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[conversationStore] Error fetching history:', error.message);
    return [];
  }

  // Return in chronological order
  return (data || []).reverse();
}

export async function getRecentOutboundMessage(
  patientId: string
): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('patient_id', patientId)
    .eq('direction', 'outbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[conversationStore] Error fetching recent outbound:', error.message);
  }

  return data;
}
