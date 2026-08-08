# 04 -- SMART BOOKING -- Complete Breakdown

## 1. Core Actions

### A. Booking Window Control

**What must happen:**
- Appointments are booked inside defined time windows based on urgency and type

**Why this is required:**
Long booking windows increase no-shows and reduce urgency.

**What breaks if missing:**
- Appointments booked weeks out unnecessarily
- Higher cancellation rates
- Unpredictable schedules

### B. Priority Slot Protection

**What must happen:**
- High-value or urgent appointments reserve priority slots

**Why this is required:**
Not all appointments are equal in revenue impact.

**What breaks if missing:**
- Emergencies displace hygiene
- Production volatility

### C. Backfill Logic

**What must happen:**
- Canceled slots are immediately flagged for reuse

**Why this is required:**
Empty chairs are unrecoverable revenue.

**What breaks if missing:**
- Same-day holes
- Lost production

---

## 2. Ownership (Human vs System)

**System-owned:**
- Slot rules
- Booking windows
- Backfill alerts

**Human-owned:**
- Final booking confirmation

**Why this split is required:**
Humans optimize for convenience. Systems optimize for revenue.

---

## 3. Failure Modes

- First-available booking mentality
- No differentiation by appointment value
- Empty slots accepted as normal

---

## 4. Recovery Logic

- Cancellation → Backfill trigger
- No-show trend → Adjust booking windows
- Underutilization → Slot rule review

---

## 5. Outputs

Smart Booking must output:
- Optimized schedules
- Reduced no-shows
- Stable daily production
