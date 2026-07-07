# Dentiflow -- MVP Agent SOPs (Self-Annealing)

**Purpose:** Lean, self-healing agent workflows for proving ROI in a single dental practice.

---

## SOP 1 -- PMS Ingest Agent

- **Objective:** Build a clean, eligible list of overdue hygiene patients.
- **Trigger:** Runs daily (early morning, local time).
- **Steps:** Pull overdue hygiene patients → normalize data → remove opt-outs/invalid numbers → dedupe → exclude recently contacted/booked patients → mark remaining as ELIGIBLE.
- **Self-Annealing:** Retry API/network errors, fallback to exports if available, dedupe conflicts automatically, escalate only if credentials or data integrity fail.

---

## SOP 2 -- Outreach Agent (SMS Sender)

- **Objective:** Send compliant, personalized outreach SMS.
- **Trigger:** After PMS ingest completes.
- **Steps:** Select up to 100 patients → validate business hours → render approved template → send SMS → log delivery → update state to MESSAGED.
- **Self-Annealing:** Retry transient SMS failures, suppress invalid numbers, throttle on rate limits, halt if state store integrity is at risk.

---

## SOP 3 -- Unified Booking Agent

- **Objective:** Convert replies into booked hygiene appointments.
- **Trigger:** On inbound SMS.
- **Steps:** Identify patient → classify intent → query real hygiene slots → offer numbered times → book selected slot → confirm booking.
- **Self-Annealing:** Re-query on slot conflicts, retry scheduler failures, deflect out-of-scope questions, escalate only on persistent scheduler auth/parsing failures.

---

## SOP 4 -- Nurture & Recovery Agent

- **Objective:** Protect show rate and recover lost appointments.
- **Trigger:** Booking events and time-based reminders.
- **Steps:** Send confirmation → send 24h and 2h reminders → handle reschedules → recover cancellations/no-shows after delay.
- **Self-Annealing:** Adjust missed reminder windows, retry provider outages, suppress hard bounces, escalate only for prolonged outages.
