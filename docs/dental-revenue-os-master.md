# 00 -- DENTAL REVENUE OPERATING SYSTEM (MASTER)

This document is the master index and system map for the complete end-to-end revenue operating system.

Each section below represents a standalone system with its own detailed SOP document. This master file exists to show flow, ownership boundaries, and how the systems interlock.

---

## 01 -- Demand Creation

Generates qualified inbound patient demand via high-intent channels. Purpose is to feed the system, not compensate for downstream leakage.

**Inputs:** Ads, SEO, Referrals
**Outputs:** Inbound calls, forms, booking attempts

---

## 02 -- Speed to Lead

Captures demand before attention decays. Controls response timing, retries, and recovery for missed connections.

**Inputs:** New inbound demand
**Outputs:** Booked appointments, scheduled follow-ups

---

## 03 -- Intake Control

Ensures the right patient is booked into the right appointment with correct expectations.

**Inputs:** Live patient conversations
**Outputs:** Correct appointment type, provider, and urgency

---

## 04 -- Smart Booking

Optimizes booking windows, protects priority slots, and enforces backfill logic to stabilize daily production.

**Inputs:** Intake-qualified patients
**Outputs:** Optimized schedules, reduced no-shows

---

## 05 -- Pre-Visit Preparation

Builds commitment before the visit through confirmations, reminders, and friction removal.

**Inputs:** Scheduled appointments
**Outputs:** Confirmed, prepared patients

---

## 06 -- Visit Experience

Doctor-owned clinical interaction that builds trust, delivers care, and frames treatment value.

**Inputs:** Patient visit
**Outputs:** Diagnosis, treatment recommendation

---

## 07 -- Revenue Capture

Converts diagnosed treatment into scheduled and completed production through follow-up and re-entry logic.

**Inputs:** Diagnosed treatment
**Outputs:** Scheduled treatment, follow-up plans

---

## 08 -- Recall & Reactivation

Recovers dormant revenue from overdue, no-show, and unscheduled patients.

**Inputs:** Dormant patient lists
**Outputs:** Rebooked appointments

---

## 09 -- Retention & Re-Entry

Maximizes lifetime value by preventing patient decay and reintroducing deferred care.

**Inputs:** Completed visits
**Outputs:** Pre-booked future care, retained patients
