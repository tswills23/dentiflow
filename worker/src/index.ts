/**
 * DentiFlow Retell Voice Agent — Cloudflare Worker
 *
 * 5 POST endpoints serving as middleware between Retell AI and backends:
 *   /lookup-patient       — Mock Dentrix lookup + Supabase check
 *   /check-availability   — Mock slot generation (skip weekends, filter by window)
 *   /book-appointment     — Mock Dentrix + REAL Supabase writes
 *   /post-call-summary    — REAL Supabase writes for ALL calls + SMS + notifications
 *   /retell-webhook       — Backup post-call data capture from Retell webhook
 *
 * CRITICAL: Response format is { "result": "{\"key\": \"value\"}" }
 *           The "result" value is a JSON-encoded STRING, not a nested object.
 *
 * Supabase failures must NOT break the Retell response — log error, return
 * success, set supabase_synced = false.
 */

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_PHONE_NUMBER: string;
  DEFAULT_PRACTICE_ID: string;
}

// ============================================================
// Helpers
// ============================================================

/** Wrap response data in Retell's required format: { result: JSON string } */
function retellResponse(data: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({ result: JSON.stringify(data) }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ============================================================
// Supabase REST helpers (no SDK — pure fetch)
// ============================================================

async function supabaseFetch(
  env: Env,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    params?: URLSearchParams;
  } = {},
): Promise<{ ok: boolean; data: any; error?: string }> {
  const url = new URL(`/rest/v1/${path}`, env.SUPABASE_URL);
  if (options.params) {
    options.params.forEach((v, k) => url.searchParams.set(k, v));
  }

  try {
    const resp = await fetch(url.toString(), {
      method: options.method || "GET",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await resp.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!resp.ok) {
      return { ok: false, data: null, error: `${resp.status}: ${text}` };
    }
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, data: null, error: e.message };
  }
}

/** Call the increment_metric Postgres function */
async function incrementMetric(
  env: Env,
  practiceId: string,
  field: string,
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  await supabaseFetch(env, "rpc/increment_metric", {
    method: "POST",
    body: {
      p_practice_id: practiceId,
      p_date: today,
      p_field: field,
    },
  });
}

// ============================================================
// Twilio SMS helper (REST API — no SDK)
// ============================================================

async function sendSms(
  env: Env,
  to: string,
  body: string,
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
    console.log(`[SMS MOCK] To: ${to} | Body: ${body}`);
    return { ok: true, sid: "MOCK_SMS_SID" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const params = new URLSearchParams({
    To: to,
    From: env.TWILIO_PHONE_NUMBER,
    Body: body,
  });

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data: any = await resp.json();
    if (!resp.ok) {
      return { ok: false, error: data.message || `Twilio ${resp.status}` };
    }
    return { ok: true, sid: data.sid };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ============================================================
// Slot generation helpers (mock Dentrix)
// ============================================================

const PROVIDERS = ["Dr. Wills", "Dr. Johnson", "Sarah (Hygienist)", "Maria (Hygienist)"];

const DURATION_MAP: Record<string, number> = {
  hygiene: 60,
  new_patient: 90,
  restorative: 60,
  cosmetic: 60,
  perio_maintenance: 60,
  consultation: 30,
  follow_up: 30,
  pediatric: 45,
};

function getNextBusinessDays(count: number): Date[] {
  const days: Date[] = [];
  const d = new Date();
  d.setDate(d.getDate() + 1); // start from tomorrow
  while (days.length < count) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function formatDate(d: Date): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

interface Slot {
  slot_id: string;
  date: string;
  time: string;
  provider: string;
  duration_minutes: number;
  iso_datetime: string;
}

function generateSlots(
  appointmentType: string,
  preferredWindow: string,
  _preferredDays: string,
): Slot[] {
  const businessDays = getNextBusinessDays(5);
  const duration = DURATION_MAP[appointmentType] || 60;

  // Morning times: 8:00, 9:00, 10:00, 11:00
  // Afternoon times: 1:00, 2:00, 3:00, 4:00
  const morningTimes = ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM"];
  const afternoonTimes = ["1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"];

  let times: string[];
  if (preferredWindow === "morning") {
    times = morningTimes;
  } else if (preferredWindow === "afternoon") {
    times = afternoonTimes;
  } else {
    times = [...morningTimes, ...afternoonTimes];
  }

  // Balance across days: pick 3 slots on different days
  const slots: Slot[] = [];
  const usedDays = new Set<number>();
  for (let i = 0; i < businessDays.length && slots.length < 3; i++) {
    const day = businessDays[i];
    if (usedDays.has(day.getDate())) continue;
    usedDays.add(day.getDate());

    const timeStr = times[slots.length % times.length];
    const provider = PROVIDERS[slots.length % PROVIDERS.length];
    const dateStr = formatDate(day);

    // Build ISO datetime for the slot
    const [hourMin, ampm] = timeStr.split(" ");
    const [hStr, mStr] = hourMin.split(":");
    let hour = parseInt(hStr);
    if (ampm === "PM" && hour !== 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    const iso = new Date(day);
    iso.setHours(hour, parseInt(mStr), 0, 0);

    slots.push({
      slot_id: `SLOT_${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, "0")}${String(day.getDate()).padStart(2, "0")}_${String(hour).padStart(2, "0")}${mStr}`,
      date: dateStr,
      time: timeStr,
      provider,
      duration_minutes: duration,
      iso_datetime: iso.toISOString(),
    });
  }

  return slots;
}

// ============================================================
// Endpoint Handlers
// ============================================================

/**
 * POST /lookup-patient
 * Mock Dentrix lookup. Also checks Supabase patients table.
 * Read-only — no Supabase writes.
 */
async function handleLookupPatient(body: any, env: Env): Promise<Response> {
  const { first_name, last_name, date_of_birth } = body;

  if (!first_name || !last_name || !date_of_birth) {
    return retellResponse({
      found: false,
      patient_id: null,
      patient_name: "",
      message: "Missing required fields: first_name, last_name, date_of_birth",
    });
  }

  const practiceId = body.practice_id || env.DEFAULT_PRACTICE_ID;

  // Check Supabase first
  let supabasePatientId: string | null = null;
  try {
    const params = new URLSearchParams();
    params.set("first_name", `eq.${first_name}`);
    params.set("last_name", `eq.${last_name}`);
    if (practiceId) {
      params.set("practice_id", `eq.${practiceId}`);
    }
    params.set("select", "id,first_name,last_name");
    params.set("limit", "1");

    const { ok, data } = await supabaseFetch(env, "patients", { params });
    if (ok && Array.isArray(data) && data.length > 0) {
      supabasePatientId = data[0].id;
    }
  } catch (e) {
    console.error("Supabase lookup error:", e);
  }

  // Mock Dentrix: always return found for now
  const patientId = supabasePatientId || `MOCK_${Date.now()}`;
  return retellResponse({
    found: true,
    patient_id: patientId,
    patient_name: first_name,
    message: "I found your record.",
  });
}

/**
 * POST /check-availability
 * Mock slot generation. Skip weekends, filter by preferred_window, balance across days.
 */
async function handleCheckAvailability(body: any, _env: Env): Promise<Response> {
  const appointmentType = body.appointment_type || "consultation";
  const preferredWindow = body.preferred_window || "any";
  const preferredDays = body.preferred_days || "";

  const slots = generateSlots(appointmentType, preferredWindow, preferredDays);

  if (slots.length === 0) {
    return retellResponse({
      available: false,
      slots: [],
      message: "I was not able to find any openings with those preferences. Would you like to try different days or times?",
    });
  }

  return retellResponse({
    available: true,
    slots: slots.map((s) => ({
      slot_id: s.slot_id,
      date: s.date,
      time: s.time,
      provider: s.provider,
      duration_minutes: s.duration_minutes,
    })),
    message: `I found ${slots.length} available times for you.`,
  });
}

/**
 * POST /book-appointment
 * Mock Dentrix booking + REAL Supabase writes:
 *   - Create/update patient
 *   - Create appointment
 *   - Log to automation_log
 *   - Increment metrics_daily.appointments_booked
 */
async function handleBookAppointment(body: any, env: Env): Promise<Response> {
  const {
    slot_id,
    first_name,
    last_name,
    appointment_type,
    is_new_patient,
    patient_id: existingPatientId,
    phone,
    date_of_birth,
    practice_id: bodyPracticeId,
  } = body;

  const practiceId = bodyPracticeId || env.DEFAULT_PRACTICE_ID;
  const mockAppointmentId = `APT_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  let supabaseSynced = false;

  // Parse slot_id to get date/time (format: SLOT_YYYYMMDD_HHMM)
  let appointmentTime: string | null = null;
  let providerName = "Dr. Wills";
  try {
    const parts = slot_id.split("_");
    if (parts.length >= 3) {
      const dateStr = parts[1]; // YYYYMMDD
      const timeStr = parts[2]; // HHMM
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      const hour = parseInt(timeStr.substring(0, 2));
      const min = parseInt(timeStr.substring(2, 4));
      const dt = new Date(year, month, day, hour, min);
      appointmentTime = dt.toISOString();
    }
  } catch {
    appointmentTime = new Date(Date.now() + 86400000).toISOString();
  }
  if (!appointmentTime) {
    appointmentTime = new Date(Date.now() + 86400000).toISOString();
  }

  // --- Supabase writes (wrapped in try/catch — must not break Retell) ---
  try {
    let patientId = existingPatientId;

    // 1. Create or find patient
    if (!patientId || patientId.startsWith("MOCK_")) {
      // Try to find by phone first
      if (phone) {
        const params = new URLSearchParams();
        params.set("phone", `eq.${phone}`);
        if (practiceId) params.set("practice_id", `eq.${practiceId}`);
        params.set("select", "id");
        params.set("limit", "1");

        const { ok, data } = await supabaseFetch(env, "patients", { params });
        if (ok && Array.isArray(data) && data.length > 0) {
          patientId = data[0].id;
        }
      }

      // Create new patient if not found
      if (!patientId || patientId.startsWith("MOCK_")) {
        const patientPayload: Record<string, unknown> = {
          practice_id: practiceId,
          first_name: first_name || "Unknown",
          last_name: last_name || "Unknown",
          phone: phone || null,
          source: "phone",
          status: "active",
          interested_service: appointment_type,
          patient_type: is_new_patient ? "new" : "existing",
        };

        const { ok, data } = await supabaseFetch(env, "patients", {
          method: "POST",
          body: patientPayload,
        });
        if (ok && Array.isArray(data) && data.length > 0) {
          patientId = data[0].id;
        }
      }
    }

    // 2. Create appointment
    if (patientId && !patientId.startsWith("MOCK_")) {
      const apptPayload = {
        practice_id: practiceId,
        patient_id: patientId,
        service_id: appointment_type,
        provider_name: providerName,
        appointment_time: appointmentTime,
        duration_minutes: DURATION_MAP[appointment_type] || 60,
        status: "scheduled",
        source: "ai_booked",
        booking_platform_id: mockAppointmentId,
        notes: `Booked via Retell voice agent. Slot: ${slot_id}`,
      };

      await supabaseFetch(env, "appointments", {
        method: "POST",
        body: apptPayload,
      });

      // 3. Automation log
      await supabaseFetch(env, "automation_log", {
        method: "POST",
        body: {
          practice_id: practiceId,
          patient_id: patientId,
          automation_type: "voice_inbound",
          action: "appointment_booked",
          result: "success",
          service_context: appointment_type,
          message_body: `Booked ${appointment_type} on ${appointmentTime} with ${providerName}`,
          metadata: { slot_id, mock_appointment_id: mockAppointmentId, is_new_patient },
        },
      });

      // 4. Increment metrics
      await incrementMetric(env, practiceId, "appointments_booked");

      supabaseSynced = true;
    }
  } catch (e: any) {
    console.error("Supabase write error in book-appointment:", e);
    supabaseSynced = false;
  }

  return retellResponse({
    booked: true,
    appointment_id: mockAppointmentId,
    message: "Your appointment has been booked successfully.",
    supabase_synced: supabaseSynced,
  });
}

/**
 * POST /post-call-summary
 * REAL Supabase writes for ALL calls:
 *   1. Create/update patient
 *   2. Save conversation record
 *   3. Log to automation_log
 *   4. Increment metrics_daily
 *   5. SMS confirmation (if booked)
 *   6. Follow-up SMS (if not booked but scheduling intent)
 *   7. Staff notification for all leads
 */
async function handlePostCallSummary(body: any, env: Env): Promise<Response> {
  const {
    caller_first_name,
    caller_last_name,
    caller_phone,
    caller_dob,
    is_new_patient,
    patient_id: existingPatientId,
    intent,
    appointment_type_discussed,
    appointment_booked,
    appointment_id,
    appointment_date,
    appointment_time,
    appointment_provider,
    needs_callback,
    was_transferred,
    transfer_reason,
    call_summary,
    practice_id: bodyPracticeId,
  } = body;

  const practiceId = bodyPracticeId || env.DEFAULT_PRACTICE_ID;
  let patientId = existingPatientId || null;
  let smsQueued = false;
  let supabaseSynced = false;

  // --- Supabase writes ---
  try {
    // 1. Find or create patient
    if (caller_phone) {
      // Try to find by phone + practice
      const params = new URLSearchParams();
      params.set("phone", `eq.${caller_phone}`);
      if (practiceId) params.set("practice_id", `eq.${practiceId}`);
      params.set("select", "id");
      params.set("limit", "1");

      const { ok, data } = await supabaseFetch(env, "patients", { params });
      if (ok && Array.isArray(data) && data.length > 0) {
        patientId = data[0].id;

        // Update existing patient with latest info
        const updates: Record<string, unknown> = {};
        if (caller_first_name) updates.first_name = caller_first_name;
        if (caller_last_name) updates.last_name = caller_last_name;
        if (appointment_type_discussed) updates.interested_service = appointment_type_discussed;
        if (appointment_booked) updates.status = "active";

        if (Object.keys(updates).length > 0) {
          await supabaseFetch(env, `patients?id=eq.${patientId}`, {
            method: "PATCH",
            body: updates,
          });
        }
      } else {
        // Create new patient
        const patientPayload: Record<string, unknown> = {
          practice_id: practiceId,
          first_name: caller_first_name || "Unknown",
          last_name: caller_last_name || "Caller",
          phone: caller_phone,
          source: "phone",
          status: appointment_booked ? "active" : "new",
          interested_service: appointment_type_discussed || intent,
          patient_type: is_new_patient ? "new" : "existing",
        };

        const createResult = await supabaseFetch(env, "patients", {
          method: "POST",
          body: patientPayload,
        });
        if (createResult.ok && Array.isArray(createResult.data) && createResult.data.length > 0) {
          patientId = createResult.data[0].id;
        }
      }
    }

    // 2. Conversation record
    if (patientId && !patientId.startsWith("MOCK_")) {
      await supabaseFetch(env, "conversations", {
        method: "POST",
        body: {
          practice_id: practiceId,
          patient_id: patientId,
          channel: "phone",
          direction: "inbound",
          message_body: call_summary || `Phone call - Intent: ${intent}`,
          service_context: appointment_type_discussed || intent,
          ai_generated: true,
          automation_type: "voice_inbound",
          status: "completed",
          metadata: {
            appointment_booked,
            appointment_id,
            was_transferred,
            transfer_reason,
            needs_callback,
            is_new_patient,
          },
        },
      });

      // 3. Automation log
      let action = "call_logged";
      if (appointment_booked) action = "appointment_booked";
      else if (was_transferred) action = `transferred_${transfer_reason || "general"}`;
      else if (needs_callback) action = "callback_requested";

      const priority = (intent === "emergency" || transfer_reason === "emergency") ? "urgent" : "normal";

      await supabaseFetch(env, "automation_log", {
        method: "POST",
        body: {
          practice_id: practiceId,
          patient_id: patientId,
          automation_type: "voice_inbound",
          action,
          result: "success",
          service_context: appointment_type_discussed || intent,
          message_body: call_summary || `${intent} call from ${caller_first_name || "Unknown"}`,
          metadata: {
            intent,
            appointment_booked,
            appointment_id,
            appointment_date,
            appointment_time,
            appointment_provider,
            was_transferred,
            transfer_reason,
            needs_callback,
            is_new_patient,
            priority,
          },
        },
      });

      // 4. Metrics
      await incrementMetric(env, practiceId, "new_leads");
      if (appointment_booked) {
        await incrementMetric(env, practiceId, "appointments_booked");
      }

      supabaseSynced = true;
    }
  } catch (e: any) {
    console.error("Supabase error in post-call-summary:", e);
    supabaseSynced = false;
  }

  // --- SMS (fire-and-forget, do not block response) ---
  try {
    if (caller_phone) {
      // 5. Confirmation SMS (if booked)
      if (appointment_booked && appointment_date && appointment_time) {
        const confirmMsg = `Hi ${caller_first_name || "there"}! Your ${appointment_type_discussed || "appointment"} at ${body.practice_name || "our office"} is confirmed for ${appointment_date} at ${appointment_time}${appointment_provider ? ` with ${appointment_provider}` : ""}. We look forward to seeing you!`;
        const smsResult = await sendSms(env, caller_phone, confirmMsg);
        if (smsResult.ok) smsQueued = true;
      }

      // 6. Follow-up SMS (if not booked but had scheduling intent)
      if (!appointment_booked && intent === "schedule") {
        const followupMsg = `Thanks for calling ${body.practice_name || "our office"}! If you would like to schedule, you can book online here: ${body.booking_url || "our website"} or call us back anytime.`;
        await sendSms(env, caller_phone, followupMsg);
        smsQueued = true;
      }

      // 7. Staff notification for all leads
      const callerName = [caller_first_name, caller_last_name].filter(Boolean).join(" ") || "Unknown";
      const urgencyTag = (intent === "emergency" || transfer_reason === "emergency") ? "[URGENT]" : "[NEW LEAD via phone]";
      const bookingStatus = appointment_booked
        ? `Booked on ${appointment_date}`
        : needs_callback
          ? "Needs callback"
          : was_transferred
            ? `Transferred for ${transfer_reason}`
            : "Did not book";

      const staffMsg = `${urgencyTag} ${callerName} called about ${appointment_type_discussed || intent || "general inquiry"}. ${bookingStatus}. Phone: ${caller_phone}`;

      // Send to practice phone (configured in env or practice record)
      // For now, log it. In production, send to practice's notification number.
      console.log(`[STAFF NOTIFICATION] ${staffMsg}`);
      // Uncomment when staff notification number is configured:
      // await sendSms(env, STAFF_PHONE, staffMsg);
    }
  } catch (e: any) {
    console.error("SMS error in post-call-summary:", e);
  }

  return retellResponse({
    logged: true,
    patient_id: patientId || "unknown",
    sms_queued: smsQueued,
    supabase_synced: supabaseSynced,
  });
}

/**
 * POST /retell-webhook
 * Backup post-call data capture from Retell's webhook.
 * Receives Retell's call_analyzed or call_ended payload.
 */
async function handleRetellWebhook(body: any, env: Env): Promise<Response> {
  const event = body.event;
  const callData = body.call || body.data || body;

  console.log(`[Retell Webhook] Event: ${event}, Call ID: ${callData.call_id || "unknown"}`);

  const practiceId = env.DEFAULT_PRACTICE_ID;

  // Extract key info from Retell's payload
  const callId = callData.call_id || `retell_${Date.now()}`;
  const transcript = callData.transcript || callData.recording_url || "";
  const callDuration = callData.call_duration_ms || callData.duration || 0;
  const disconnectionReason = callData.disconnection_reason || "unknown";

  // Log to automation_log as backup
  try {
    await supabaseFetch(env, "automation_log", {
      method: "POST",
      body: {
        practice_id: practiceId,
        automation_type: "voice_inbound",
        action: "retell_webhook_received",
        result: "logged",
        message_body: typeof transcript === "string" ? transcript.substring(0, 5000) : JSON.stringify(transcript).substring(0, 5000),
        metadata: {
          retell_call_id: callId,
          event,
          call_duration_ms: callDuration,
          disconnection_reason: disconnectionReason,
          raw_keys: Object.keys(callData),
        },
      },
    });
  } catch (e: any) {
    console.error("Retell webhook Supabase error:", e);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ============================================================
// Router
// ============================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS headers for all responses
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    if (request.method !== "POST") {
      return errorResponse(405, "Method not allowed. Use POST.");
    }

    const url = new URL(request.url);
    const path = url.pathname;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "Invalid JSON body");
    }

    switch (path) {
      case "/lookup-patient":
        return handleLookupPatient(body, env);
      case "/check-availability":
        return handleCheckAvailability(body, env);
      case "/book-appointment":
        return handleBookAppointment(body, env);
      case "/post-call-summary":
        return handlePostCallSummary(body, env);
      case "/retell-webhook":
        return handleRetellWebhook(body, env);
      default:
        return errorResponse(404, `Unknown endpoint: ${path}`);
    }
  },
};
