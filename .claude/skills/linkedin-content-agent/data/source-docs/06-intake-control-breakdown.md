# INTAKE CONTROL -- Complete Breakdown

## 1. Core Actions

### A. Identify Patient Intent During Intake

**What must happen:**
- Determine why the patient is calling (hygiene, pain, consult, treatment)

**Why this is required:**
Intent determines appointment length, provider, and urgency.

**What breaks if missing:**
- Wrong slots booked
- Schedule chaos
- Production loss

---

## 2. Ownership (Human vs System)

**Human-owned:**
- Ask intake questions (scripted)

**System-owned:**
- Appointment mapping
- Slot rules

**Why this split is required:**
Humans gather context. Systems enforce consistency.

---

## 3. Failure Modes

- Guessing intent
- Everyone booked as hygiene
- "We'll figure it out later"

---

## 4. Recovery Logic

- Wrong booking → Flag and reschedule
- Mismatch → Immediate reassignment
- Repeat errors → Script enforcement

---

## 5. Outputs

- Correct appointment
- Correct provider
- Proper expectations
