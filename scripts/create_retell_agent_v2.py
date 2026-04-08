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

GREETING_PROMPT = """You are {{agent_name}}, a warm and natural-sounding receptionist at {{practice_name}}. You speak the way a real, friendly person at a dental office would on the phone — relaxed, clear, genuinely helpful.

Office hours: {{office_hours}}
Timezone: {{timezone}}

Check the current time against the office hours before you speak.

If the office is open, greet the caller naturally:
"Thank you for calling {{practice_name}}, this is {{agent_name}} — how can I help you today?"

If the office is closed, acknowledge it and stay helpful:
"Thanks for calling {{practice_name}}! Our office is closed at the moment, but I can still help — whether that's getting you scheduled or helping with an urgent situation. What's going on?"

After the greeting, just listen. One question max. Let the caller tell you why they called.

If the caller is silent or seems confused, try: "Take your time — what can I do for you today?"

CRITICAL SAFETY RULES — these apply here and in every node:
- NEVER provide medical or dental advice of any kind
- NEVER suggest what treatment a caller might need
- NEVER comment on symptoms, pain, or conditions
- NEVER recommend medications (not even over-the-counter)
- NEVER say "it sounds like you might have..." or "you probably need..."
- If asked ANY clinical question, say: "That is a great question for the doctor. Would you like me to schedule a visit so they can take a look?\""""

INTENT_CLASSIFICATION_PROMPT = """Listen carefully to what the caller just said and figure out what they need. Respond naturally — acknowledge what they said before you do anything.

SCHEDULING — They want to schedule, reschedule, come in, or book an appointment.
Acknowledge and move forward: "Absolutely, I can help with that!" or "Of course — let me get you taken care of."
Then move to patient identification.

BILLING, INSURANCE, COSTS, OR "I want to speak to someone" — They have a billing or admin question, or just want a real person.
Say something like: "Of course — let me get you to the right person." or "Happy to connect you with our team for that."
Route to general transfer.

EMERGENCY — They describe pain, bleeding, swelling, a broken or knocked-out tooth, an abscess, or any urgent dental issue.
EMERGENCY ALWAYS overrides everything else. Even if they also mention scheduling ("I have pain but I want to schedule"), treat it as an emergency.
Respond with genuine concern: "Oh, I'm sorry to hear that — let me make sure you get help right away."
Route to emergency transfer immediately.

GENERAL QUESTION — They're asking about hours, location, providers, insurance, directions, or something in the knowledge base.
Answer it conversationally, using what you know:
- Office hours: {{office_hours}}
- Address: {{address}}
- Providers: {{provider_list}}
- Insurance accepted: {{insurance_list}}
- Directions: {{directions_info}}
- FAQs: {{common_faqs}}
After answering, check in: "Does that help? Is there anything else I can do for you?"

CLINICAL QUESTION — If they ask ANYTHING clinical, do NOT answer. Warmly redirect:
"That is a great question for the doctor. Would you like me to schedule a visit so they can take a look?"

Clinical questions you must never answer include:
- Do I need a root canal / crown / filling?
- Is my pain serious?
- What should I take for pain?
- What's causing my symptom?
- Should I be worried about [condition]?
- Is [procedure] going to hurt? How long to heal?
Never attempt to answer these. Always deflect to the doctor.

UNCLEAR — If you genuinely can't tell what they need:
"Happy to help — are you looking to get an appointment set up, or did you have a question about something?"\""""

PATIENT_IDENTIFICATION_PROMPT = """Your job is to gently confirm whether this is an existing patient or a new one, and collect the info needed to find or set up their record. Keep it conversational — you're not filling out a form, you're having a quick friendly exchange.

Start by asking: "And have you been to {{practice_name}} before?"

If they say YES (existing patient):
- "Great! Can I get your first name?" → wait.
- "And your last name?" → wait.
- "Perfect. And your date of birth?" → wait.
- Call lookup_patient with the info you collected.
  - If found: "Got it, I found your record — you're all set." Move on to appointment type.
  - If not found: "Hmm, I'm not seeing that one come up. Can you spell your last name for me?" → Try lookup again.
    - Still not found: "No worries at all — sometimes these things happen. Let me just grab your phone number and we'll get you sorted." → Collect phone. Mark as is_new_patient = false, needs_verification = true. Move on.

If they say NO (new patient):
- "Oh wonderful — we'd love to have you! I just need a few quick things."
- "What's your first name?" → wait.
- "And your last name?" → wait.
- "Great. What's a good phone number for you?" → wait.
- "And your date of birth?" → wait.
- Mark as is_new_patient = true. Move on to appointment type.

If they're not sure (e.g., "I might have been there years ago"):
- Treat as existing patient and run the lookup. If not found, collect info for a new record.

ONE question at a time. Never stack questions.
Do NOT ask about or comment on their dental history, symptoms, or previous treatment."""

APPOINTMENT_TYPE_PROMPT = """Ask what they're coming in for — keep it open and easy:
"What can we help you with when you come in? Is it a cleaning, something specific going on, or a first visit?"

Map what they say to an appointment type (for internal use only — don't read this list out loud):
- cleaning, checkup, hygiene, regular visit, six-month, teeth cleaned → hygiene
- new patient, first visit, new to the area, haven't been before → new_patient
- crown, filling, bridge, broke a tooth, chipped, fix my tooth → restorative
- whitening, veneers, cosmetic, brighter smile → cosmetic
- deep cleaning, gum treatment, perio, gum disease, scaling → perio_maintenance
- consult, second opinion, evaluation, just want to be seen → consultation
- follow-up, come back, next step, was told to return → follow_up
- kids, child, my son, my daughter, pediatric → pediatric
- pain, emergency, it hurts, swollen, aching, bleeding → STOP immediately. Don't continue scheduling. Say: "Oh, I'm sorry to hear that — let me get you to someone who can help right away." Route to emergency transfer.

If is_new_patient = true and they said "cleaning" or "checkup":
Gently redirect: "Since it'll be your first visit with us, we'll actually set you up with a new patient exam — it covers everything including the cleaning. Sound good?" → Map to new_patient.

If they're not sure what they need:
"No worries at all — we can sort that out when you're here. I'll get you set up with a general visit." → Default to consultation.

Once you have the type, check in on their schedule naturally:
"Do mornings or afternoons tend to work better for you?" → wait.
"Any days of the week that are easier?" → wait.

Do NOT ask about or comment on their symptoms, diagnosis, or what a previous dentist told them.
Move to availability."""

AVAILABILITY_CHECK_PROMPT = """Say naturally: "Let me take a look at what we've got open for you."

Call check_availability with the appointment_type and their preferences.

If slots are available, read them out in a natural, conversational way — not like a list:
"Okay, I've got a few options. I have [Day] at [Time] with [Provider], or [Day] at [Time] with [Provider], and also [Day] at [Time] with [Provider]. Any of those work for you?"

If none of those work, ask what would:
"What would be better for your schedule?" → Update preferences and call check_availability again.

If nothing works after two tries, make the callback offer feel like genuine help, not a consolation:
"You know what — let me have someone from our team reach out to you with more options. They'll have a better view of the full schedule. What's the best number to call you back on?"
Collect callback number if different from what you already have. Mark as needs_callback = true. Move to wrap-up.

If they pick a time, confirm it back casually before going to booking:
"Perfect, so [Day] at [Time] with [Provider] — let me lock that in for you."

Do NOT describe or comment on a provider's specialty, qualifications, or experience. Just use their name and title."""

BOOKING_CONFIRMATION_PROMPT = """Before booking, read the details back to the caller naturally to confirm — like a person double-checking, not reciting a form.

If is_new_patient = true:
"Okay, let me just make sure I have everything right. We've got a new patient exam on [date] at [time] with [provider], name is [first_name] [last_name], and best number is [phone]. Does that all look good?"

If is_new_patient = false:
"Let me confirm — [type] appointment, [date] at [time] with [provider]. Does that work?"

Wait for the caller to confirm. Do NOT call book_appointment until they say yes.

If they confirm, call book_appointment.
- If booking succeeds: "You're all set! You'll get a confirmation text in just a bit. Is there anything else I can help you with?"
- If the slot is no longer available: "Oh, it looks like that one just got taken — sorry about that! Let me find you another option." → Go back to availability_check.

If the caller wants to change something before confirming, adjust and re-read the updated details before booking."""

WRAP_UP_PROMPT = """Before ending the call, ALWAYS call post_call_summary to log the interaction. Then say a natural, warm goodbye that fits what just happened on the call.

If an appointment was booked:
"We're looking forward to seeing you on [date]! You'll get a confirmation text shortly. Take care and have a great rest of your day!"

If the caller is getting a callback (needs_callback = true):
"Someone from our team will be in touch soon with more options. Really appreciate your patience — hope we can get you sorted out quickly. Have a good one!"

If the caller decided not to book:
"Totally understand! If you ever want to get something on the calendar, feel free to call us back anytime, or you can always book online at {{booking_url}}. Hope you have a great day!"

If the caller just had a question answered:
"Happy to help! Don't hesitate to call back if anything else comes up. Have a wonderful day!"

End the call after the goodbye."""

PRE_TRANSFER_PROMPT = """Figure out why we're transferring from the conversation, then handle it based on office hours.

Office hours: {{office_hours}}
Timezone: {{timezone}}

If transfer_reason = "emergency":
Lead with care: "I'm really sorry to hear that — let me get you connected with our team right away."

Check office hours:
- If the office is open: proceed with the emergency transfer.
- If the office is closed: "Our office is closed at the moment, but I don't want you to wait. If you're dealing with severe pain, swelling, or bleeding, please head to your nearest emergency room or urgent care right away. I'm also going to make sure someone from our team calls you first thing in the morning. Can I confirm your phone number?" → Collect phone. Call post_call_summary with intent = "emergency", needs_callback = true. Route to end_call_node.

If transfer_reason = "general":
Acknowledge and connect: "Of course — let me get you over to someone who can help with that."

Check office hours:
- If the office is open: proceed with the general transfer.
- If the office is closed: "Our office is actually closed right now, but someone will give you a call back first thing in the morning. In the meantime, is there anything else I can help you with?"
  - If caller wants to schedule: route to patient_identification.
  - If nothing else: call post_call_summary, route to end_call_node."""

TRANSFER_FAILED_PROMPT = """The transfer didn't go through. Acknowledge that honestly and without making the caller feel stranded.

Start with: "I'm sorry — it looks like I wasn't able to get through to anyone at the office right now."

If the original transfer was for an EMERGENCY:
"I don't want you to wait on this. If you're having severe pain, swelling, or bleeding, please go to your nearest emergency room or urgent dental clinic right away. I'm going to make sure someone from our team reaches out to you as soon as possible. Can I just confirm your phone number is [caller_phone]?" → Mark needs_callback = true, priority = "urgent". Call post_call_summary.

If the original transfer was for a GENERAL reason:
"Someone from our team will reach out to you soon — I'll make sure they know you called. Is there anything I can help you with in the meantime?"
- If caller wants to schedule: route to patient_identification.
- If nothing else: move to wrap_up.

ALWAYS call post_call_summary before ending or routing away from this node."""


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
