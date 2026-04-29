import * as fs from 'fs';
import * as path from 'path';
import { supabase } from '../../lib/supabase';
import type { Practice } from '../../types/database';

export interface DirectiveContext {
  persona: string;
  responseRules: string;
  intentDetection: string;
  bookingFlow: string;
  escalation: string;
  serviceDirectives: Map<string, string>;
  practice: Practice;
  // Recall reply directives (loaded from directives/ root)
  recallPersona: string;
  recallReplyRules: string;
  recallBookingAgent: string;
  recallReplyExamples: string;
}

// In-memory cache for directive files (they rarely change)
const directiveCache = new Map<string, string>();

const DIRECTIVES_DIR = path.resolve(__dirname, '../../../directives');

function loadDirectiveFile(filePath: string): string {
  if (directiveCache.has(filePath)) {
    return directiveCache.get(filePath)!;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    directiveCache.set(filePath, content);
    return content;
  } catch (error) {
    console.error(`[directiveLoader] Failed to load ${filePath}:`, error);
    return '';
  }
}

function interpolateDirective(template: string, practice: Practice): string {
  const config = practice.practice_config || {};
  return template
    .replace(/\{\{practice_name\}\}/g, practice.name)
    .replace(/\{\{practice_phone\}\}/g, practice.phone || '')
    .replace(/\{\{brand_voice\}\}/g, practice.brand_voice || 'professional')
    .replace(/\{\{booking_url\}\}/g, practice.booking_url || '')
    .replace(/\{\{insurance_note\}\}/g, (config as Record<string, string>).insurance_note || '')
    .replace(/\{\{new_patient_special\}\}/g, (config as Record<string, string>).new_patient_special || '');
}

export async function loadDirectives(practiceId: string): Promise<DirectiveContext> {
  // Load practice from database
  const { data: practice, error } = await supabase
    .from('practices')
    .select('*')
    .eq('id', practiceId)
    .single();

  if (error || !practice) {
    throw new Error(`Practice not found: ${practiceId}`);
  }

  const typedPractice = practice as unknown as Practice;

  // Load system directives
  const systemDir = path.join(DIRECTIVES_DIR, 'system');
  const persona = loadDirectiveFile(path.join(systemDir, 'stl-persona.md'));
  const responseRules = loadDirectiveFile(path.join(systemDir, 'stl-response-rules.md'));
  const intentDetection = loadDirectiveFile(path.join(systemDir, 'stl-intent-detection.md'));
  const bookingFlow = loadDirectiveFile(path.join(systemDir, 'stl-booking-flow.md'));
  const escalation = loadDirectiveFile(path.join(systemDir, 'stl-escalation.md'));

  // Load service directives
  const serviceDirectives = new Map<string, string>();
  const servicesDir = path.join(DIRECTIVES_DIR, 'services');
  try {
    const serviceFiles = fs.readdirSync(servicesDir).filter((f) => f.endsWith('.md'));
    for (const file of serviceFiles) {
      const serviceId = file.replace('.md', '');
      serviceDirectives.set(serviceId, loadDirectiveFile(path.join(servicesDir, file)));
    }
  } catch {
    console.warn('[directiveLoader] No service directives found');
  }

  // Load recall directives
  const recallPersona = loadDirectiveFile(path.join(DIRECTIVES_DIR, 'recall_persona.md'));
  const recallReplyRules = loadDirectiveFile(path.join(DIRECTIVES_DIR, 'recall_reply_rules.md'));
  const recallBookingAgent = loadDirectiveFile(path.join(DIRECTIVES_DIR, 'sms_booking_agent.md'));
  const recallReplyExamples = loadDirectiveFile(path.join(DIRECTIVES_DIR, 'recall_reply_examples.md'));

  // Interpolate practice-specific values
  return {
    persona: interpolateDirective(persona, typedPractice),
    responseRules: interpolateDirective(responseRules, typedPractice),
    intentDetection,
    bookingFlow: interpolateDirective(bookingFlow, typedPractice),
    escalation,
    serviceDirectives,
    practice: typedPractice,
    recallPersona: interpolateDirective(recallPersona, typedPractice),
    recallReplyRules,
    recallBookingAgent: interpolateDirective(recallBookingAgent, typedPractice),
    recallReplyExamples: interpolateDirective(recallReplyExamples, typedPractice),
  };
}

export function clearDirectiveCache(): void {
  directiveCache.clear();
}
