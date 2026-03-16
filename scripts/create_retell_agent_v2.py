#!/usr/bin/env python3
"""
DentiFlow Retell Voice Agent v2 — Creation Script

Creates the conversation flow (12 nodes) and agent via Retell API.
Uses EXACT prompts from the V2 spec with all clinical guardrails.

Usage:
    pip install requests python-dotenv
    python scripts/create_retell_agent_v2.py
"""

import os
import json
import sys
import requests

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ============================================================
# Configuration
# ============================================================

RETELL_API_KEY = os.getenv("RETELL_API_KEY", "")
if not RETELL_API_KEY:
    print("ERROR: RETELL_API_KEY environment variable is required.")
    sys.exit(1)

WORKER_BASE_URL = os.getenv(
    "WORKER_BASE_URL",
    "https://dentiflow-retell-worker.workers.dev"
)

RETELL_API = "https://api.retellai.com"
HEADERS = {
    "Authorization": f"Bearer {RETELL_API_KEY}",
    "Content-Type": "application/json",
}

# Dynamic variable defaults — read from env with fallbacks
DYNAMIC_VARS = {
    "practice_name": os.getenv("PRACTICE_NAME", "Wills Family Dentistry"),
    "agent_name": os.getenv("AGENT_NAME", "Sarah"),
    "office_hours": os.getenv("OFFICE_HOURS", "Monday through Friday, 8 AM to 5 PM"),
    "timezone": os.getenv("TIMEZONE", "America/Chicago"),
    "address": os.getenv("PRACTICE_ADDRESS", "123 Main Street, Suite 100, Chicago IL 60601"),
    "provider_list": os.getenv("PROVIDER_LIST", "Dr. Wills, Dr. Johnson, Sarah (Hygienist), Maria (Hygienist)"),
    "insurance_list": os.getenv("INSURANCE_LIST", "Delta Dental, Cigna, Aetna, MetLife, Guardian, United Healthcare"),
    "directions_info": os.getenv("DIRECTIONS_INFO", "Located on the corner of Main and 2nd. Free parking in the rear lot."),
    "common_faqs": os.getenv("COMMON_FAQS", "Payment plans available. We see patients of all ages. Handicap accessible. Se habla espanol."),
    "transfer_number": os.getenv("TRANSFER_NUMBER", "+16305551234"),
    "booking_url": os.getenv("BOOKING_URL", "https://example.com/book"),
    "practice_id": os.getenv("DEFAULT_PRACTICE_ID", "demo-practice-id"),
}


# ============================================================
# Node Prompts — EXACT from V2 spec
# ============================================================

GREETING_PROMPT = """You are a friendly receptionist for {{practice_name}}. Your name is {{agent_name}}.

FIRST: Check the current time against the office hours.
Office hours: {{office_hours}}
Timezone: {{timezone}}

IF THE OFFICE IS CURRENTLY OPEN:
"Thank you for calling {{practice_name}}, this is {{agent_name}}. How can I help you today?"

IF THE OFFICE IS CURRENTLY CLOSED:
"Thank you for calling {{practice_name}}. Our office is closed right now, but I can still help you. I can schedule an appointment for you, or if you have an emergency, I can help with that too. What can I do for you?"

Then listen. Do not ask multiple questions. Just greet and listen.

CRITICAL SAFETY RULES (apply to this node and ALL nodes):
- NEVER provide medical or dental advice of any kind
- NEVER suggest what treatment a caller might need
- NEVER comment on symptoms, pain, or conditions
- NEVER recommend medications (not even over-the-counter)
- NEVER say "it sounds like you might have..." or "you probably need..."
- If asked ANY clinical question, say: "That is a great question for the doctor. Would you like me to schedule a visit so they can take a look?\""""

INTENT_CLASSIFICATION_PROMPT = """Based on what the caller said, determine their intent.

SCHEDULING INTENT — If they want to SCHEDULE, RESCHEDULE, BOOK, or COME IN:
Continue toward scheduling.

TRANSFER INTENT — If they ask about INSURANCE, BILLING, COSTS, PAYMENT, CANCEL an appointment, or WANT TO SPEAK TO A PERSON:
Say: "Of course, let me connect you with someone who can help with that."
Route to transfer.

EMERGENCY INTENT — If they describe PAIN, BLEEDING, SWELLING, BROKEN TOOTH, KNOCKED OUT TOOTH, ABSCESS, or any EMERGENCY:
Say: "I am sorry to hear that. I want to make sure you are taken care of right away."
Route to emergency transfer.
NOTE: Emergency ALWAYS overrides other intents. If someone says "I have pain and I want to schedule" → treat as emergency.

GENERAL QUESTION — If they ask something from the knowledge base, answer it:
- Office hours: {{office_hours}}
- Address: {{address}}
- Providers: {{provider_list}}
- Insurance accepted: {{insurance_list}}
- Directions: {{directions_info}}
- FAQs: {{common_faqs}}
After answering: "Is there anything else I can help with?"

CLINICAL QUESTION — If they ask ANYTHING clinical (see list below), DO NOT ANSWER. Instead:
"That is a great question for the doctor. Would you like me to schedule a visit so they can take a look?"

Clinical questions include but are not limited to:
- "Do I need a root canal / crown / filling / extraction?"
- "Is my tooth pain serious?"
- "What should I take for the pain?"
- "My dentist said I need X, do you think that is right?"
- "What is causing my [symptom]?"
- "Should I be worried about [condition]?"
- "Is [procedure] painful?"
- "How long will [treatment] take to heal?"
ALWAYS deflect to the doctor. NEVER attempt to answer clinical questions.

UNCLEAR — If you cannot determine intent:
"Are you looking to schedule an appointment, or did you have a question about something else?\""""

PATIENT_IDENTIFICATION_PROMPT = """Ask: "Have you been to {{practice_name}} before?"

IF YES (existing patient):
- Ask for first name. Wait for response.
- Ask for last name. Wait for response.
- Ask for date of birth. Wait for response.
- Call lookup_patient with this information.
- If found: "Great, I found your record." Move on to appointment type.
- If NOT found: "Hmm, I am not finding that in our system. Can you spell your last name for me?"
  - Try lookup again with corrected spelling.
  - If still not found: "No worries, let me just grab your phone number so we can get you set up."
    - Collect phone number.
    - Mark this patient as is_new_patient = false, needs_verification = true.
    - Move on to appointment type.

IF NO (new patient):
- "Welcome! We would love to have you. Just need a few quick details."
- Collect first name. Wait for response.
- Collect last name. Wait for response.
- Collect phone number. Wait for response.
- Collect date of birth. Wait for response.
- Mark this patient as is_new_patient = true.
- Move on to appointment type.

COLLECT ONE PIECE OF INFORMATION AT A TIME. Never ask for multiple items in one sentence.
Do NOT comment on or ask about their medical/dental history."""

APPOINTMENT_TYPE_PROMPT = """Ask: "What are you looking to come in for? A cleaning, a specific concern, or something else?"

Map the response to an appointment type:
- cleaning, checkup, hygiene, regular visit, six month, teeth cleaned = hygiene
- new patient, first visit, have not been here, new to area = new_patient
- crown, filling, bridge, treatment, fix my tooth, broke, chipped = restorative
- whitening, veneers, cosmetic, brighten, whiter teeth = cosmetic
- deep cleaning, perio, gum treatment, gum disease, scaling = perio_maintenance
- consult, second opinion, evaluation, want to be seen = consultation
- follow up, come back, next step, was told to return = follow_up
- kids, child, my son, my daughter, pediatric = pediatric
- pain, emergency, hurt, ache, swollen = STOP. Do not continue scheduling. Say "I am sorry to hear that. Let me get you taken care of right away." Route to emergency transfer.

If is_new_patient = true AND they said "cleaning" or "checkup":
Override to new_patient type (new patients need a comprehensive exam, not just a cleaning).
Say: "Since this is your first visit, we will set you up with a new patient exam which includes a cleaning."

If unclear: "No problem! We will figure out exactly what you need when you come in. Let me find you a time."
Default to: consultation

Then ask about preferences:
"Do you prefer mornings or afternoons?"
Wait for response.
"Any particular day work best?"
Wait for response.

Do NOT ask about or comment on their symptoms, condition, or treatment history.
Move to availability."""

AVAILABILITY_CHECK_PROMPT = """Say: "Let me check what we have available."

Call check_availability with the appointment_type and preferences.

If slots available:
Read 2-3 options clearly: "I have [Day] at [Time] with [Provider], [Day] at [Time] with [Provider], or [Day] at [Time] with [Provider]. Which works best for you?"

If caller does not like the options:
"What would work better for you?"
Update preferences and call check_availability again.

If nothing works after TWO tries:
"I want to make sure we find the right time for you. Can I have someone from our team call you back with more options? What is the best number to reach you?"
Collect callback number if different from caller ID.
Move to wrap_up. Mark as needs_callback = true.

If they pick a time, repeat it back for confirmation before moving to booking.

Do NOT mention specific providers' specialties or qualifications. Just use their name and title."""

BOOKING_CONFIRMATION_PROMPT = """Confirm the details clearly:

If is_new_patient = true:
"Just to confirm, that is a new patient exam on [date] at [time] with [provider]. We have your name as [first_name] [last_name] and your number as [phone]. Does that all sound right?"

If is_new_patient = false:
"Just to confirm, that is a [type] appointment on [date] at [time] with [provider]. Sound right?"

WAIT for the caller to say yes. Do NOT book until they explicitly confirm.

Once confirmed, call book_appointment.

If booking succeeds:
"You are all set! You will get a confirmation text shortly. Is there anything else I can help with?"

If booking fails (slot taken):
"It looks like that time just got taken. Let me check for another option."
Go back to availability_check."""

WRAP_UP_PROMPT = """If appointment was booked:
"We look forward to seeing you on [date]. You will get a confirmation text shortly. Have a wonderful day!"

If caller did not book (needs callback):
"Someone from our team will give you a call. Thank you for calling {{practice_name}}!"

If caller did not book (chose not to):
"Thank you for calling {{practice_name}}. If you change your mind, you can call back anytime or book online at {{booking_url}}. Have a great day!"

If caller had a general question answered:
"Thank you for calling {{practice_name}}. Have a wonderful day!"

Before ending, ALWAYS call post_call_summary to log this interaction.
Then end the call."""

PRE_TRANSFER_PROMPT = """Determine the transfer reason from the conversation context.

IF transfer_reason = "emergency":
"I am sorry to hear that. I want to make sure you are taken care of right away. Let me connect you with our team."

Check current time against {{office_hours}}:
- If office is OPEN: proceed with transfer.
- If office is CLOSED: "Our office is closed right now. If this is severe pain, swelling, or bleeding, please go to your nearest emergency room. Someone from our team will also call you back first thing in the morning. Can I confirm your phone number?"
  Collect phone. Call post_call_summary with intent = "emergency", needs_callback = true.
  Route to end_call_node (do NOT attempt transfer to closed office).

IF transfer_reason = "general":
"Of course, let me connect you with someone who can help with that."

Check current time against {{office_hours}}:
- If office is OPEN: proceed with transfer.
- If office is CLOSED: "Our office is closed right now, but someone will call you back first thing in the morning. Can I help with anything else in the meantime?"
  If caller wants to schedule: route to patient_identification.
  If nothing else: call post_call_summary, route to end_call_node."""

TRANSFER_FAILED_PROMPT = """"I am sorry, I was not able to reach anyone at the office right now."

IF the original transfer was for EMERGENCY:
"If you are experiencing severe pain, swelling, or bleeding, please go to your nearest emergency room. I am going to make sure someone from our team calls you back as soon as possible. Can I confirm your phone number is [caller_phone]?"
Mark as needs_callback = true, priority = "urgent".

IF the original transfer was for GENERAL:
"Someone from our team will call you back shortly. Is there anything else I can help with in the meantime?"
If caller wants to schedule: route to patient_identification.
If nothing else: proceed to wrap_up.

ALWAYS call post_call_summary to log the failed transfer."""


# ============================================================
# Function Definitions (Custom Functions for Retell nodes)
# ============================================================

def make_lookup_patient():
    return {
        "type": "custom",
        "name": "lookup_patient",
        "description": "Look up an existing patient by name and date of birth in the practice management system.",
        "url": f"{WORKER_BASE_URL}/lookup-patient",
        "method": "POST",
        "speak_during_execution": True,
        "speak_during_execution_message": "Let me look that up for you.",
        "speak_after_execution": True,
        "parameters": {
            "type": "object",
            "properties": {
                "first_name": {
                    "type": "string",
                    "description": "Patient first name",
                },
                "last_name": {
                    "type": "string",
                    "description": "Patient last name",
                },
                "date_of_birth": {
                    "type": "string",
                    "description": "Date of birth MM/DD/YYYY",
                },
            },
            "required": ["first_name", "last_name", "date_of_birth"],
        },
    }


def make_check_availability():
    return {
        "type": "custom",
        "name": "check_availability",
        "description": "Check available appointment slots by type and time preference.",
        "url": f"{WORKER_BASE_URL}/check-availability",
        "method": "POST",
        "speak_during_execution": True,
        "speak_during_execution_message": "Let me check what we have available.",
        "speak_after_execution": True,
        "parameters": {
            "type": "object",
            "properties": {
                "appointment_type": {
                    "type": "string",
                    "description": "hygiene, new_patient, restorative, cosmetic, perio_maintenance, consultation, follow_up, or pediatric",
                },
                "preferred_window": {
                    "type": "string",
                    "description": "morning, afternoon, or any",
                },
                "preferred_days": {
                    "type": "string",
                    "description": "Preferred days if stated, otherwise empty",
                },
                "practice_id": {
                    "type": "string",
                    "description": "Practice identifier for multi-location support",
                },
            },
            "required": ["appointment_type"],
        },
    }


def make_book_appointment():
    return {
        "type": "custom",
        "name": "book_appointment",
        "description": "Book a confirmed appointment slot for the patient.",
        "url": f"{WORKER_BASE_URL}/book-appointment",
        "method": "POST",
        "speak_during_execution": True,
        "speak_during_execution_message": "One moment while I check on that for you.",
        "speak_after_execution": True,
        "parameters": {
            "type": "object",
            "properties": {
                "slot_id": {
                    "type": "string",
                    "description": "Slot ID from check_availability",
                },
                "patient_id": {
                    "type": "string",
                    "description": "Patient ID from lookup, or empty string for new patients",
                },
                "is_new_patient": {
                    "type": "boolean",
                    "description": "True if new patient, false if existing",
                },
                "first_name": {
                    "type": "string",
                    "description": "Patient first name",
                },
                "last_name": {
                    "type": "string",
                    "description": "Patient last name",
                },
                "phone": {
                    "type": "string",
                    "description": "Patient phone number",
                },
                "date_of_birth": {
                    "type": "string",
                    "description": "Patient DOB",
                },
                "appointment_type": {
                    "type": "string",
                    "description": "Appointment type",
                },
                "practice_id": {
                    "type": "string",
                    "description": "Practice identifier",
                },
            },
            "required": [
                "slot_id",
                "first_name",
                "last_name",
                "appointment_type",
                "is_new_patient",
            ],
        },
    }


def make_post_call_summary():
    return {
        "type": "custom",
        "name": "post_call_summary",
        "description": "Log the call interaction to the DentiFlow backend. Triggers SMS confirmations and staff notifications.",
        "url": f"{WORKER_BASE_URL}/post-call-summary",
        "method": "POST",
        "speak_during_execution": False,
        "speak_after_execution": False,
        "parameters": {
            "type": "object",
            "properties": {
                "caller_first_name": {"type": "string"},
                "caller_last_name": {"type": "string"},
                "caller_phone": {"type": "string"},
                "caller_dob": {"type": "string"},
                "is_new_patient": {"type": "boolean"},
                "patient_id": {
                    "type": "string",
                    "description": "From lookup, or empty",
                },
                "intent": {
                    "type": "string",
                    "description": "schedule, emergency, insurance, general_question, clinical_question",
                },
                "appointment_type_discussed": {"type": "string"},
                "appointment_booked": {"type": "boolean"},
                "appointment_id": {"type": "string"},
                "appointment_date": {"type": "string"},
                "appointment_time": {"type": "string"},
                "appointment_provider": {"type": "string"},
                "needs_callback": {"type": "boolean"},
                "was_transferred": {"type": "boolean"},
                "transfer_reason": {"type": "string"},
                "call_summary": {
                    "type": "string",
                    "description": "Brief 1-2 sentence summary of what happened on the call",
                },
                "practice_id": {"type": "string"},
            },
            "required": [
                "caller_phone",
                "intent",
                "appointment_booked",
                "practice_id",
            ],
        },
    }


# ============================================================
# Build Conversation Flow — 12 Nodes
# ============================================================

def build_flow():
    """Build the complete conversation flow payload for Retell API."""

    nodes = []
    edges = []

    # ---- Node 1: greeting (conversation) — ENTRY POINT ----
    nodes.append({
        "id": "greeting",
        "type": "conversation",
        "data": {
            "name": "greeting",
            "prompt": GREETING_PROMPT,
            "tools": [],
        },
    })
    edges.append({
        "source": "greeting",
        "target": "intent_classification",
        "data": {
            "condition": "Caller responds to greeting",
        },
    })

    # ---- Node 2: intent_classification (conversation) ----
    nodes.append({
        "id": "intent_classification",
        "type": "conversation",
        "data": {
            "name": "intent_classification",
            "prompt": INTENT_CLASSIFICATION_PROMPT,
            "tools": [],
        },
    })
    # Scheduling intent
    edges.append({
        "source": "intent_classification",
        "target": "patient_identification",
        "data": {
            "condition": "Caller wants to schedule, reschedule, or book an appointment",
        },
    })
    # Transfer intent (insurance, billing, costs, cancel, wants a person)
    edges.append({
        "source": "intent_classification",
        "target": "pre_transfer",
        "data": {
            "condition": "Caller asks about insurance, billing, costs, cancellation, or wants to speak to a person. Set transfer_reason = general.",
        },
    })
    # Emergency intent
    edges.append({
        "source": "intent_classification",
        "target": "pre_transfer",
        "data": {
            "condition": "Caller describes pain, bleeding, swelling, broken tooth, or any emergency. Set transfer_reason = emergency.",
        },
    })
    # General question answered, no further needs
    edges.append({
        "source": "intent_classification",
        "target": "wrap_up",
        "data": {
            "condition": "General question answered and caller has no further needs",
        },
    })
    # Clinical question deflected, caller wants to schedule
    edges.append({
        "source": "intent_classification",
        "target": "patient_identification",
        "data": {
            "condition": "Clinical question deflected and caller wants to schedule an appointment",
        },
    })
    # Clinical question deflected, caller declines
    edges.append({
        "source": "intent_classification",
        "target": "wrap_up",
        "data": {
            "condition": "Clinical question deflected and caller declines scheduling",
        },
    })

    # ---- Node 3: patient_identification (conversation) ----
    nodes.append({
        "id": "patient_identification",
        "type": "conversation",
        "data": {
            "name": "patient_identification",
            "prompt": PATIENT_IDENTIFICATION_PROMPT,
            "tools": [make_lookup_patient()],
        },
    })
    edges.append({
        "source": "patient_identification",
        "target": "appointment_type",
        "data": {
            "condition": "Patient identified (found in system or new patient info collected)",
        },
    })

    # ---- Node 4: appointment_type (conversation) ----
    nodes.append({
        "id": "appointment_type",
        "type": "conversation",
        "data": {
            "name": "appointment_type",
            "prompt": APPOINTMENT_TYPE_PROMPT,
            "tools": [],
        },
    })
    edges.append({
        "source": "appointment_type",
        "target": "availability_check",
        "data": {
            "condition": "Appointment type and time preferences collected",
        },
    })
    edges.append({
        "source": "appointment_type",
        "target": "pre_transfer",
        "data": {
            "condition": "Caller describes pain or emergency during type selection. Set transfer_reason = emergency.",
        },
    })

    # ---- Node 5: availability_check (conversation) ----
    nodes.append({
        "id": "availability_check",
        "type": "conversation",
        "data": {
            "name": "availability_check",
            "prompt": AVAILABILITY_CHECK_PROMPT,
            "tools": [make_check_availability()],
        },
    })
    edges.append({
        "source": "availability_check",
        "target": "booking_confirmation",
        "data": {
            "condition": "Caller selected an available time slot",
        },
    })
    edges.append({
        "source": "availability_check",
        "target": "wrap_up",
        "data": {
            "condition": "No suitable slot found after two checks and caller accepted a callback",
        },
    })

    # ---- Node 6: booking_confirmation (conversation) ----
    nodes.append({
        "id": "booking_confirmation",
        "type": "conversation",
        "data": {
            "name": "booking_confirmation",
            "prompt": BOOKING_CONFIRMATION_PROMPT,
            "tools": [make_book_appointment()],
        },
    })
    edges.append({
        "source": "booking_confirmation",
        "target": "wrap_up",
        "data": {
            "condition": "Appointment booked successfully and caller has no more questions",
        },
    })
    edges.append({
        "source": "booking_confirmation",
        "target": "intent_classification",
        "data": {
            "condition": "Appointment booked and caller has another question",
        },
    })
    edges.append({
        "source": "booking_confirmation",
        "target": "availability_check",
        "data": {
            "condition": "Booking failed (slot taken) or caller wants a different time",
        },
    })

    # ---- Node 7: wrap_up (conversation) ----
    nodes.append({
        "id": "wrap_up",
        "type": "conversation",
        "data": {
            "name": "wrap_up",
            "prompt": WRAP_UP_PROMPT,
            "tools": [make_post_call_summary()],
        },
    })
    edges.append({
        "source": "wrap_up",
        "target": "end_call_node",
        "data": {
            "condition": "Post-call summary complete and caller said goodbye",
        },
    })
    edges.append({
        "source": "wrap_up",
        "target": "intent_classification",
        "data": {
            "condition": "Caller has another question before hanging up",
        },
    })

    # ---- Node 8: pre_transfer (conversation) ----
    nodes.append({
        "id": "pre_transfer",
        "type": "conversation",
        "data": {
            "name": "pre_transfer",
            "prompt": PRE_TRANSFER_PROMPT,
            "tools": [make_post_call_summary()],
        },
    })
    # Emergency, office open
    edges.append({
        "source": "pre_transfer",
        "target": "transfer_emergency_node",
        "data": {
            "condition": "Transfer reason is emergency and office is currently open",
        },
    })
    # General, office open
    edges.append({
        "source": "pre_transfer",
        "target": "transfer_call_node",
        "data": {
            "condition": "Transfer reason is general and office is currently open",
        },
    })
    # Emergency, office closed (ER guidance given, post_call_summary called)
    edges.append({
        "source": "pre_transfer",
        "target": "end_call_node",
        "data": {
            "condition": "Transfer reason is emergency but office is closed. ER guidance given and post_call_summary logged.",
        },
    })
    # General, office closed, wants to schedule
    edges.append({
        "source": "pre_transfer",
        "target": "patient_identification",
        "data": {
            "condition": "Transfer reason is general, office is closed, and caller wants to schedule an appointment",
        },
    })
    # General, office closed, no further needs
    edges.append({
        "source": "pre_transfer",
        "target": "end_call_node",
        "data": {
            "condition": "Transfer reason is general, office is closed, and caller has no further needs",
        },
    })

    # ---- Node 9: transfer_failed (conversation) ----
    nodes.append({
        "id": "transfer_failed",
        "type": "conversation",
        "data": {
            "name": "transfer_failed",
            "prompt": TRANSFER_FAILED_PROMPT,
            "tools": [make_post_call_summary()],
        },
    })
    # Emergency transfer failed
    edges.append({
        "source": "transfer_failed",
        "target": "end_call_node",
        "data": {
            "condition": "Emergency transfer failed. ER guidance given and logged.",
        },
    })
    # General transfer failed, wants to schedule
    edges.append({
        "source": "transfer_failed",
        "target": "patient_identification",
        "data": {
            "condition": "General transfer failed and caller wants to schedule an appointment",
        },
    })
    # General transfer failed, no further needs
    edges.append({
        "source": "transfer_failed",
        "target": "wrap_up",
        "data": {
            "condition": "General transfer failed and caller has no further needs",
        },
    })

    # ---- Node 10: transfer_call_node (call_transfer) ----
    nodes.append({
        "id": "transfer_call_node",
        "type": "call_transfer",
        "data": {
            "transfer_destination": DYNAMIC_VARS["transfer_number"],
        },
    })
    edges.append({
        "source": "transfer_call_node",
        "target": "transfer_failed",
        "data": {
            "condition": "Transfer fails to connect (no answer, busy, or technical failure)",
        },
    })

    # ---- Node 11: transfer_emergency_node (call_transfer) ----
    nodes.append({
        "id": "transfer_emergency_node",
        "type": "call_transfer",
        "data": {
            "transfer_destination": DYNAMIC_VARS["transfer_number"],
        },
    })
    edges.append({
        "source": "transfer_emergency_node",
        "target": "transfer_failed",
        "data": {
            "condition": "Emergency transfer fails to connect",
        },
    })

    # ---- Node 12: end_call_node (end) ----
    nodes.append({
        "id": "end_call_node",
        "type": "end",
        "data": {},
    })

    return nodes, edges


# ============================================================
# API Calls
# ============================================================

def create_flow():
    """Create the conversation flow via Retell API."""
    nodes, edges = build_flow()

    payload = {
        "name": f"{DYNAMIC_VARS['practice_name']} — AI Receptionist v2",
        "nodes": nodes,
        "edges": edges,
        "starting_node_id": "greeting",
        "dynamic_variables": DYNAMIC_VARS,
    }

    print(f"Creating conversation flow with {len(nodes)} nodes and {len(edges)} edges...")
    resp = requests.post(
        f"{RETELL_API}/create-conversation-flow",
        headers=HEADERS,
        json=payload,
    )

    if resp.status_code not in (200, 201):
        print(f"ERROR creating flow: {resp.status_code}")
        print(resp.text)
        sys.exit(1)

    data = resp.json()
    flow_id = data.get("conversation_flow_id") or data.get("id")
    print(f"  Flow ID: {flow_id}")
    return flow_id, data


def create_agent(flow_id):
    """Create the Retell agent attached to the conversation flow."""
    payload = {
        "agent_name": f"{DYNAMIC_VARS['practice_name']} AI Receptionist",
        "voice_id": "retell-Chloe",
        "response_engine": {
            "type": "retell-conversation-flow",
            "conversation_flow_id": flow_id,
        },
        "language": "en-US",
        "model_choice": "gpt-4.1",
        "start_speaker": "agent",
        "enable_backchannel": True,
        "backchannel_frequency": 0.8,
        "responsiveness": 1.0,
        "interruption_sensitivity": 0.8,
        "enable_dynamic_voice_speed": True,
        "enable_dynamic_responsiveness": True,
        "reminder_trigger_ms": 12000,
        "reminder_max_count": 2,
        "dynamic_variables": DYNAMIC_VARS,
    }

    print("Creating agent...")
    resp = requests.post(
        f"{RETELL_API}/create-agent",
        headers=HEADERS,
        json=payload,
    )

    if resp.status_code not in (200, 201):
        print(f"ERROR creating agent: {resp.status_code}")
        print(resp.text)
        sys.exit(1)

    data = resp.json()
    agent_id = data.get("agent_id") or data.get("id")
    print(f"  Agent ID: {agent_id}")
    return agent_id, data


# ============================================================
# Main
# ============================================================

def main():
    print("=" * 60)
    print("DentiFlow Retell Voice Agent v2 — Setup")
    print("=" * 60)
    print()
    print(f"Practice:    {DYNAMIC_VARS['practice_name']}")
    print(f"Agent name:  {DYNAMIC_VARS['agent_name']}")
    print(f"Worker URL:  {WORKER_BASE_URL}")
    print()

    flow_id, flow_data = create_flow()
    agent_id, agent_data = create_agent(flow_id)

    print()
    print("=" * 60)
    print("SUCCESS")
    print("=" * 60)
    print(f"  Flow ID:  {flow_id}")
    print(f"  Agent ID: {agent_id}")
    print()
    print("Next steps:")
    print("  1. Deploy the Cloudflare Worker: cd worker && wrangler deploy")
    print("  2. Set Worker secrets: wrangler secret put SUPABASE_URL, etc.")
    print("  3. Configure Retell webhook: POST /retell-webhook")
    print("  4. Test with Retell playground or a real phone call")
    print()

    # Save IDs for reference
    output = {
        "flow_id": flow_id,
        "agent_id": agent_id,
        "practice_name": DYNAMIC_VARS["practice_name"],
        "worker_base_url": WORKER_BASE_URL,
    }
    with open(".tmp/retell_agent_v2_ids.json", "w") as f:
        json.dump(output, f, indent=2)
    print("  Saved IDs to .tmp/retell_agent_v2_ids.json")


if __name__ == "__main__":
    main()
