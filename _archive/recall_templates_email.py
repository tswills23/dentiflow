#!/usr/bin/env python3
"""
Recall V2 Template Bank

45 email templates: 3 voices × 3 days × 5 variants

Template selection is deterministic based on patient email hash.
Templates follow strict content rules:
- Human, conversational tone
- No urgency language
- No incentives
- No emojis
- No insurance/treatment mentions
- Easy A/B closes (mornings/afternoons, this week/next week)

USER: Populate the templates below with actual content
"""

import hashlib


# ============================================================================
# TEMPLATE BANK (USER TO POPULATE)
# ============================================================================

TEMPLATES = {
    # Office Voice (< 6 months overdue)
    "office": {
        0: {  # Day 0
            "v1": {
                "subject": "Quick note from {{Practice Name}}",
                "body": """Hi {{First Name}},

It's been about {{Months}} months since your last visit. We have some open slots coming up.

Would you like to get on the schedule?

— {{Practice Name}} Team"""
            },
            "v2": {
                "subject": "Time for your cleaning?",
                "body": """Hi {{First Name}},

Just checking in - it's been {{Months}} months since we last saw you.

We have availability this week and next. Would mornings or afternoons work better?

— {{Practice Name}} Team"""
            },
            "v3": {
                "subject": "{{First Name}}, ready to schedule?",
                "body": """Hi {{First Name}},

We noticed it's been about {{Months}} months since your last cleaning.

Want to get back on the calendar? We have a few spots open.

— {{Practice Name}} Team"""
            },
            "v4": {
                "subject": "Cleaning reminder from {{Practice Name}}",
                "body": """Hi {{First Name}},

Hope you're doing well! It's been {{Months}} months since your last hygiene visit.

We'd love to see you soon. Any days work best for you?

— {{Practice Name}} Team"""
            },
            "v5": {
                "subject": "Let's get you scheduled",
                "body": """Hi {{First Name}},

It's been about {{Months}} months. We have some openings and wanted to reach out.

Would you like to book your cleaning?

— {{Practice Name}} Team"""
            },
        },
        1: {  # Day 1 (USER TO POPULATE - these are placeholders)
            "v1": {
                "subject": "[DAY 1 OFFICE V1 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v2": {
                "subject": "[DAY 1 OFFICE V2 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v3": {
                "subject": "[DAY 1 OFFICE V3 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v4": {
                "subject": "[DAY 1 OFFICE V4 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v5": {
                "subject": "[DAY 1 OFFICE V5 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
        },
        3: {  # Day 3 (USER TO POPULATE - these are placeholders)
            "v1": {
                "subject": "[DAY 3 OFFICE V1 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v2": {
                "subject": "[DAY 3 OFFICE V2 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v3": {
                "subject": "[DAY 3 OFFICE V3 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v4": {
                "subject": "[DAY 3 OFFICE V4 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v5": {
                "subject": "[DAY 3 OFFICE V5 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
        },
    },

    # Hygienist Voice (6-12 months overdue)
    "hygienist": {
        0: {  # Day 0
            "v1": {
                "subject": "Time to check in",
                "body": """Hi {{First Name}},

This is Sarah from {{Practice Name}}. Even when everything feels fine, regular visits help keep things on track.

Would mornings or afternoons work better to come in?

— {{Practice Name}} Team"""
            },
            "v2": {
                "subject": "Let's get you scheduled",
                "body": """Hi {{First Name}},

Sarah here at {{Practice Name}}. I wanted to personally reach out and make this easy.

Would this week or next week be better to get you back on the schedule?

— {{Practice Name}} Team"""
            },
            "v3": {
                "subject": "Quick check-in from {{Practice Name}}",
                "body": """Hi {{First Name}},

This is Sarah from {{Practice Name}}. We try to catch things early before they become bigger issues.

Would earlier or later in the week work better to come in?

— {{Practice Name}} Team"""
            },
            "v4": {
                "subject": "Staying on track",
                "body": """Hi {{First Name}},

Sarah here. I know life gets busy, but regular visits really do help long term.

Would mornings or evenings be easier for you?

— {{Practice Name}} Team"""
            },
            "v5": {
                "subject": "Checking in from {{Practice Name}}",
                "body": """Hi {{First Name}},

This is Sarah at {{Practice Name}}. Just checking in to help you stay on track.

Would this week or next week make more sense to come in?

— {{Practice Name}} Team"""
            },
        },
        1: {  # Day 1
            "v1": {
                "subject": "[DAY 1 HYGIENIST V1 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v2": {
                "subject": "[DAY 1 HYGIENIST V2 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v3": {
                "subject": "[DAY 1 HYGIENIST V3 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v4": {
                "subject": "[DAY 1 HYGIENIST V4 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v5": {
                "subject": "[DAY 1 HYGIENIST V5 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
        },
        3: {  # Day 3
            "v1": {
                "subject": "[DAY 3 HYGIENIST V1 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v2": {
                "subject": "[DAY 3 HYGIENIST V2 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v3": {
                "subject": "[DAY 3 HYGIENIST V3 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v4": {
                "subject": "[DAY 3 HYGIENIST V4 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v5": {
                "subject": "[DAY 3 HYGIENIST V5 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
        },
    },

    # Doctor Voice (12+ months overdue)
    "doctor": {
        0: {  # Day 0
            "v1": {
                "subject": "Personal note from Dr. Smith",
                "body": """Hi {{First Name}},

This is Dr. Smith from {{Practice Name}}. I noticed it's been a while since I last saw you and wanted to personally check in.

Would this week or next week make more sense to come back in?

— Dr. Smith, {{Practice Name}}"""
            },
            "v2": {
                "subject": "Important to keep an eye on things",
                "body": """Hi {{First Name}},

Dr. Smith here at {{Practice Name}}. Even when things feel fine, it's important we keep an eye on things.

Would mornings or afternoons work better to come in?

— Dr. Smith, {{Practice Name}}"""
            },
            "v3": {
                "subject": "Let's get you back on the calendar",
                "body": """Hi {{First Name}},

This is Dr. Smith. I wanted to reach out directly and make scheduling simple.

Would early in the week or later be better to get you back on the calendar?

— Dr. Smith, {{Practice Name}}"""
            },
            "v4": {
                "subject": "Checking in from Dr. Smith",
                "body": """Hi {{First Name}},

Dr. Smith from {{Practice Name}}. Just checking in since I haven't seen you in some time.

Would this week or next week be easier for a quick visit?

— Dr. Smith, {{Practice Name}}"""
            },
            "v5": {
                "subject": "Getting you back on track",
                "body": """Hi {{First Name}},

This is Dr. Smith. Happy to help you get back on track.

Would mornings or evenings work better for you?

— Dr. Smith, {{Practice Name}}"""
            },
        },
        1: {  # Day 1
            "v1": {
                "subject": "[DAY 1 DOCTOR V1 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v2": {
                "subject": "[DAY 1 DOCTOR V2 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v3": {
                "subject": "[DAY 1 DOCTOR V3 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v4": {
                "subject": "[DAY 1 DOCTOR V4 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v5": {
                "subject": "[DAY 1 DOCTOR V5 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
        },
        3: {  # Day 3
            "v1": {
                "subject": "[DAY 3 DOCTOR V1 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v2": {
                "subject": "[DAY 3 DOCTOR V2 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v3": {
                "subject": "[DAY 3 DOCTOR V3 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v4": {
                "subject": "[DAY 3 DOCTOR V4 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
            "v5": {
                "subject": "[DAY 3 DOCTOR V5 - USER TO PROVIDE]",
                "body": """[USER TO PROVIDE]"""
            },
        },
    },
}


# ============================================================================
# TEMPLATE SELECTION & RENDERING
# ============================================================================

def select_template(assigned_voice, sequence_day, patient_email):
    """
    Select template variant deterministically based on patient email

    Args:
        assigned_voice: str ("office" | "hygienist" | "doctor")
        sequence_day: int (0, 1, or 3)
        patient_email: str

    Returns:
        dict: {"subject": str, "body": str}
    """
    # Use email hash to select variant (deterministic)
    email_hash = int(hashlib.md5(patient_email.encode()).hexdigest(), 16)
    variant_num = (email_hash % 5) + 1  # 1-5
    variant_id = f"v{variant_num}"

    template = TEMPLATES[assigned_voice][sequence_day][variant_id]

    return template


def render_template(template, first_name, practice_name, months_overdue):
    """
    Fill in template variables

    Args:
        template: dict with 'subject' and 'body'
        first_name: str
        practice_name: str
        months_overdue: int

    Returns:
        tuple: (subject, body)
    """
    subject = template["subject"]
    body = template["body"]

    # Replace placeholders
    subject = subject.replace("{{First Name}}", first_name)
    subject = subject.replace("{{Practice Name}}", practice_name)

    body = body.replace("{{First Name}}", first_name)
    body = body.replace("{{Practice Name}}", practice_name)
    body = body.replace("{{Months}}", str(months_overdue))

    return subject, body


def get_template_id(assigned_voice, sequence_day, patient_email):
    """
    Get template ID for logging

    Args:
        assigned_voice: str
        sequence_day: int
        patient_email: str

    Returns:
        str: e.g., "office_day0_v3"
    """
    email_hash = int(hashlib.md5(patient_email.encode()).hexdigest(), 16)
    variant_num = (email_hash % 5) + 1
    return f"{assigned_voice}_day{sequence_day}_v{variant_num}"


# Example usage
if __name__ == '__main__':
    # Test template selection
    test_email = "patient@example.com"

    for voice in ["office", "hygienist", "doctor"]:
        for day in [0, 1, 3]:
            template = select_template(voice, day, test_email)
            subject, body = render_template(template, "John", "Smith Dental", 8)
            template_id = get_template_id(voice, day, test_email)

            print(f"\n{template_id}:")
            print(f"Subject: {subject}")
            print(f"Body preview: {body[:100]}...")
