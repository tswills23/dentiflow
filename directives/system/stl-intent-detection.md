# Speed-to-Lead Intent Detection

## booking_request
Patient wants to schedule an appointment.
Signals: book, schedule, appointment, available, openings, come in,
new patient, sign up, get started, when can I, set up, need to see

## emergency
Patient describes pain, urgency, or dental trauma.
Signals: pain, hurts, hurt, ache, aching, swollen, swelling, broken,
chipped, cracked, knocked out, bleeding, abscess, infection, throbbing,
can't eat, can't sleep, emergency
PRIORITY: This overrides all other intents. Always classify as emergency
if pain/trauma words are present, even alongside other intents.

## insurance_question
Patient asking about coverage, plans, cost with insurance.
Signals: insurance, coverage, covered, PPO, HMO, Delta Dental,
Cigna, Aetna, MetLife, United, accept, take my, in network, out of network

## pricing_question
Patient asking about cost without insurance context.
Signals: how much, cost, price, pricing, expensive, affordable, fee,
payment plan, financing, what does it run

## service_question
Patient asking about what a procedure involves or general dental questions.
Signals: what is, how does, how long, what to expect, does it hurt,
is it painful, recovery, downtime, how many visits

## slot_confirmation
Patient picking from offered times. ONLY if we offered times in last message.
Signals: yes, yeah, sure, that works, sounds good, first/second/third,
day names, specific times, morning, afternoon

## greeting
Short messages just saying hello (under 30 characters).
Signals: hi, hey, hello, good morning

## opt_out
Patient wants to stop messages.
Signals: stop, unsubscribe, opt out, remove me, don't text
ACTION: Immediately stop. Update status to inactive. Do NOT respond.

## Disambiguation
- Pain + booking = emergency (pain overrides)
- Price + booking = booking_request (action overrides question)
- "New patient" = booking_request (they want to come in)
- "Do you take my insurance" = insurance_question
- Ambiguous → general_inquiry, ask what they need help with
