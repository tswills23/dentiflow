import { supabase } from '../../lib/supabase';

export async function incrementMetric(
  practiceId: string,
  field: string,
  date?: Date
): Promise<void> {
  const dateStr = (date || new Date()).toISOString().split('T')[0];

  const { error } = await supabase.rpc('increment_metric', {
    p_practice_id: practiceId,
    p_date: dateStr,
    p_field: field,
  });

  if (error) {
    console.error(`[metricsTracker] Error incrementing ${field}:`, error.message);
  }
}

export async function recordResponseTime(
  practiceId: string,
  responseTimeMs: number,
  date?: Date
): Promise<void> {
  const dateStr = (date || new Date()).toISOString().split('T')[0];

  // Ensure the row exists
  await supabase
    .from('metrics_daily')
    .upsert(
      { practice_id: practiceId, date: dateStr },
      { onConflict: 'practice_id,date' }
    );

  // Update running average
  const { data: current } = await supabase
    .from('metrics_daily')
    .select('avg_response_time_ms, total_responses')
    .eq('practice_id', practiceId)
    .eq('date', dateStr)
    .single();

  if (current) {
    const totalResponses = (current.total_responses || 0) + 1;
    const currentAvg = current.avg_response_time_ms || 0;
    const newAvg = Math.round(
      (currentAvg * (totalResponses - 1) + responseTimeMs) / totalResponses
    );

    const updates: Record<string, number> = {
      avg_response_time_ms: newAvg,
      total_responses: totalResponses,
    };

    if (responseTimeMs < 60_000) {
      updates.under_60s_count = (current as Record<string, number>).under_60s_count
        ? (current as Record<string, number>).under_60s_count + 1
        : 1;
    }

    await supabase
      .from('metrics_daily')
      .update(updates)
      .eq('practice_id', practiceId)
      .eq('date', dateStr);
  }
}

export async function logAutomation(params: {
  practiceId: string;
  patientId?: string;
  automationType: string;
  action?: string;
  result?: string;
  responseTimeMs?: number;
  messageBody?: string;
  serviceContext?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('automation_log').insert({
    practice_id: params.practiceId,
    patient_id: params.patientId || null,
    automation_type: params.automationType,
    action: params.action || null,
    result: params.result || 'triggered',
    response_time_ms: params.responseTimeMs || null,
    message_body: params.messageBody || null,
    service_context: params.serviceContext || null,
    error_message: params.errorMessage || null,
    metadata: params.metadata || {},
  });

  if (error) {
    console.error('[metricsTracker] Error logging automation:', error.message);
  }
}
