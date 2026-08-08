# Case Study #1 — Real SMS Conversation Threads

**Source:** Village Dental A/B test, Arm A (3-voice sequence). Launched 2026-05-12.
**Pulled:** 2026-06-02
**Anonymization:** Patient first names → "Patient". Phone numbers → "(***) ***-XXXX".
**Use:** Embed in case study screen recording (sections 1:30–7:00). Show real conversation flow.

---

## Thread 1 — Booked (S6_COMPLETED)

**Patient:** Patient ((***) ***-XXXX)  
**Sequence ID:** `722618ab...`  
**Sequence started:** Tue 5:23 AM  
**Messages exchanged:** 7

```
[Wed 6:20 AM]  32 Dental →
Hey Patient, just a heads up from Village Dental Village Dental — we've got a few spots open and wanted to see if you'd like to grab one: https://dentiflow-production.up.railway.app/r/fc2b0aff-6f93-4ee7-a85f-1a83badb6a55

[Wed 6:20 AM]  32 Dental →
Hey Patient, just a heads up from Village Dental Village Dental — we've got a few spots open and wanted to see if you'd like to grab one: https://dentiflow-production.up.railway.app/r/58aa9ae0-0740-4547-b60e-903153bd1791

[Tue 7:58 AM]  32 Dental →
Hey Patient, hope things are good. Team at Village Dental wanted to check in since you're due for a visit. You free to text?

[Wed 8:00 AM]  32 Dental →
Hey Patient, Village Dental again. You probably feel fine — most people do. That's actually when it's easiest to stay that way. Pick a time: https://dentiflow-production.up.railway.app/r/d2f04e7c-34db-481c-a550-1739577bdeae

[Thu 9:00 AM]  32 Dental →
Hey Patient, were you able to grab a time at Village Dental Village Dental? Reply YES if you're all set, or let us know if you need help!

[Thu 10:19 AM]  ← Patient
Yes

[Thu 10:19 AM]  32 Dental →
Perfect, see you then. Give us a call if anything changes.

```

## Thread 2 — Declined (EXIT_DECLINED)

**Patient:** Patient ((***) ***-XXXX)  
**Sequence ID:** `73240ea6...`  
**Sequence started:** Tue 5:23 AM  
**Messages exchanged:** 6

```
[Tue 8:02 AM]  32 Dental →
Hey Patient, it's Dr. Philip at Village Dental. I know it's been a while and that's totally fine. Had something I wanted to run by you though. You around?

[Tue 10:21 AM]  ← Patient
Hi, yeah I'm around what's going on

[Tue 10:21 AM]  32 Dental →
It's been over a year and a half since you've been in — we wanted to reach out personally to get you taken care of. Let's get you back in for a checkup. Does earlier or later in the week work better?

[Tue 10:23 AM]  ← Patient
I don't need any service right now, thanks

[Tue 10:23 AM]  32 Dental →
No worries — was it a timing thing or did you find somewhere else?

[Tue 10:24 AM]  ← Patient
I'm going somewhere else

```

## Thread 3 — Opted Out (EXIT_OPT_OUT)

**Patient:** Patient ((***) ***-XXXX)  
**Sequence ID:** `9972f99d...`  
**Sequence started:** Tue 5:23 AM  
**Messages exchanged:** 11

```
[Wed 6:23 AM]  32 Dental →
Hey Patient, Dr. Dr. Phillip here from Village Dental Village Dental. Had something come up I wanted to touch base with you about. You free to text?

[Wed 6:23 AM]  32 Dental →
Hey Patient, Dr. Dr. Phillip here from Village Dental Village Dental. Had something come up I wanted to touch base with you about. You free to text?

[Tue 8:02 AM]  32 Dental →
Hey Patient, it's Dr. Philip at Village Dental. I know it's been a while and that's totally fine. Had something I wanted to run by you though. You around?

[Tue 8:39 AM]  ← Patient
Hello Doc. What's up?

[Tue 8:39 AM]  32 Dental →
Haven't seen you in over a year and a half — wanted to reach out personally to get you taken care of. Let's get you back in for a checkup. Does earlier or later in the week work better?

[Tue 8:44 AM]  ← Patient
I really like you guys, but I don't work in Elk Grove any longer.    Plus you know I'm a big baby.  I got another one that should be pulled and need a cleaning.

[Tue 8:44 AM]  32 Dental →
I get it — we'll make it super simple and easy for you. Worth the drive to get you taken care of. Does this week or next work better to come back in? https://dentiflow-production.up.railway.app/r/9433bd93-04f7-4aad-9e70-1ed8c5033f77

[Tue 8:45 AM]  ← Patient
Neither right now.  Maybe at end of month.

[Tue 8:45 AM]  32 Dental →
Got it, you're off the list. If you ever need us, just give us a call.

[Tue 8:56 AM]  ← Patient
I'll dew it sune.

[Tue 10:53 AM]  32 Dental →
Hey Patient — sorry, my last reply was off. End of the month works great. Want me to reach back out in a couple weeks to find a time, or feel free to call us at 847-364-5100 whenever you're ready.

```

