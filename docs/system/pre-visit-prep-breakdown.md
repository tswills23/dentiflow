# PRE-VISIT PREPARATION -- Complete Breakdown

## 1. Core Actions

### A. Multi-Touch Confirmations

**What must happen:**
- SMS + email reminders

**Why this is required:**
Attendance is decided before visit day.

**What breaks if missing:**
- No-shows
- Schedule padding

---

## 2. Ownership

**System-owned:**
- Reminders
- Paperwork

**Human-owned:**
- Exceptions

---

## 3. Failure Modes

- Single reminder
- Paperwork at arrival

---

## 4. Recovery Logic

- No confirmation → outbound reminder
- Cancel → immediate backfill

---

## 5. Outputs

- Confirmed appointments
- Prepared patients
