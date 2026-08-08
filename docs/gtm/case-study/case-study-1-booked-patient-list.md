# Case Study #1 — Booked Patient List (for Front-Desk Revenue Export)

> ℹ️ **ROUND 1 ONLY.** This is the R1 candidate pool (5/12 launch) — the 4 system-confirmed + 45 link-clickers behind R1's 11 bookings. It does **not** include Round 2's 21 bookings; there is no equivalent R2 name list in this repo. Case-study revenue is now **confirmed combined at $9,600** (32 bookings × ~$300) — see [case-study-1-village-recall.md](./case-study-1-village-recall.md). Keep this file as the R1 source record; don't rewrite its counts to the combined total.

**Source:** Production DB, Arm A (control_voice, 3-voice sequence)
**Test window:** 2026-05-12 through 2026-05-26 (14 days, Round 1)
**Pulled:** 2026-06-02

---

## Important: this DB pull is a candidate pool, not the confirmed 11

Trevor reported **11 confirmed bookings** from Arm A via manual Dentrix cross-reference. The production DB only shows **4 patients** reaching booking-intent state (S6_COMPLETED) — those are guaranteed bookings per our system.

The other 7 confirmed bookings happened **outside our visible loop**: patient clicked the booking link, went to the external scheduler, booked without our state machine seeing it. OR called the office directly.

That means the other 7 are almost certainly somewhere in the **45 link-clickers** below. The front desk can verify which by cross-checking against actual Dentrix appointment data for these phone numbers / names.

---

## Cohort 1 — S6_COMPLETED (4 patients, system-confirmed bookings)

These patients reached booking-intent in our AI chat. Confirmed bookings per Dentiflow.

| # | First Name | Last Name | Phone | Link clicked |
|---|---|---|---|---|
| 1 | Kurian | Joseph | +18473408790 | 2026-05-13 |
| 2 | Christine | Harris | +17082872213 | 2026-05-13 |
| 3 | Mariah | Faiola-Ferguson | +12245429291 | 2026-05-13 |
| 4 | Eleanor | Helm | +18472640587 |  |

---

## Cohort 2 — Link-clickers (45 patients, likely contains the other 7 bookings)

These patients clicked the booking link but our state machine never advanced to S6_COMPLETED. They likely booked through Dentrix Ascend's external scheduler or by phone — invisible to our system.

| # | First Name | Last Name | Phone | Link clicked |
|---|---|---|---|---|
| 1 | Eduardo | Loconte | +18472874683 | 2026-05-13 |
| 2 | Maria | Delgado | +17733076111 | 2026-05-15 |
| 3 | Marife | Dimitrov | +17732632000 | 2026-05-13 |
| 4 | John | Fischer | +18477158617 | 2026-05-13 |
| 5 | Ronda | Mattey | +12242206889 | 2026-05-13 |
| 6 | Lenny | Chirinos-benavides | +16302900096 | 2026-05-13 |
| 7 | Cole | Cruse | +12243558394 | 2026-05-13 |
| 8 | Mary | George | +17082637298 | 2026-05-13 |
| 9 | Debbie | Mize | +18473121785 | 2026-05-13 |
| 10 | Debra | Morales | +12243258107 | 2026-05-13 |
| 11 | Hanmian | Chen | +12024007035 | 2026-05-13 |
| 12 | Cathleen | Eul | +12245658405 | 2026-05-13 |
| 13 | Robert | Hermiz | +18475335478 | 2026-05-13 |
| 14 | Reshma | Khatoon | +18476909633 | 2026-05-13 |
| 15 | Georgina | Luna | +12244819752 | 2026-05-15 |
| 16 | Tim | Curtin | +18475086867 | 2026-05-13 |
| 17 | Janet | Durso | +16302001221 | 2026-05-13 |
| 18 | Jennifer | Kochan | +18472712767 | 2026-05-13 |
| 19 | Mya | McCurdy | +16307151584 | 2026-05-13 |
| 20 | Irma | Delgado | +17738167290 | 2026-05-13 |
| 21 | Katherine | Meagher | +18473541126 | 2026-05-13 |
| 22 | Sofia | Lopez | +12247168197 | 2026-05-13 |
| 23 | Shari | Labuda | +18474010397 | 2026-05-13 |
| 24 | Francisco | Garcia | +18159959431 | 2026-05-13 |
| 25 | Gerardo | Gonzalez | +14044063918 | 2026-05-13 |
| 26 | Maiten | Frega | +18473319539 | 2026-05-13 |
| 27 | Sanobar | Hussain | +16302610757 | 2026-05-13 |
| 28 | Erika | Cueto | +17089551348 | 2026-05-15 |
| 29 | Maria | Munyon | +18473370610 | 2026-05-13 |
| 30 | Julie | Clasen | +16309010728 | 2026-05-13 |
| 31 | Dayanna | Hargrow | +18723335086 | 2026-05-13 |
| 32 | George | Mekvabishvili | +19293687998 | 2026-05-13 |
| 33 | Maximillian | Dee | +17735513619 | 2026-05-13 |
| 34 | Kristen | Chellson | +18478459194 | 2026-05-13 |
| 35 | Natsuko | Kunihiro | +18472246859 | 2026-05-13 |
| 36 | Wendy | Goranson | +18474899639 | 2026-05-15 |
| 37 | Sabrina | Heline | +18479567436 | 2026-05-13 |
| 38 | Andre | Dixon | +14077568287 | 2026-05-13 |
| 39 | Judy | Froemming | +17736816563 | 2026-05-13 |
| 40 | Ramnath | Krishnaswamy | +18473614384 | 2026-05-13 |
| 41 | Ewa | Dunaj | +17735771151 | 2026-05-13 |
| 42 | Andrey | Martin | +13128853125 | 2026-05-13 |
| 43 | Jackie | Cyburt | +12242615887 | 2026-05-13 |
| 44 | Dimitrinka | Hristova | +12245951936 | 2026-05-13 |
| 45 | Kathleen | Clauson | +18472549369 | 2026-05-13 |

---

## Ask for Scott (text to send to Village front desk)

> "Hey — for the case study Trevor's putting together, can you cross-reference the patient list below against Dentrix appointments scheduled or completed between 2026-05-12 and today? We're looking for the ~11 we confirmed booked. Then run a Production by Patient report for just those, sum the production column, and send back the total. Should take ~15 minutes."

---

## What we need back

Just one number: **total production (in dollars) for the confirmed booked patients in the date range above.**

Step-by-step for the front desk:
1. Open Dentrix Ascend
2. For each name on the list, check if an appointment exists between 2026-05-12 and today
3. For the patients who DID have an appointment, pull production via Reports → Production by Patient
4. Sum the production column across all confirmed-booked patients
5. Send back the total

> **HIPAA note:** Do NOT share the report itself outside the practice. Only the aggregated total dollar number is needed.

---

## If Trevor already has the 11 names locked from prior cross-reference

Skip this file — just hand the front desk that confirmed list of 11 directly. This file is the candidate pool in case the original confirmation list isn't handy.
