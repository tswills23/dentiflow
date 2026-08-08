// Public legal pages. Meta requires a reachable privacy policy URL before an
// app can leave Development mode, and GHL/Lovable have no page for it.
//
//   GET /privacy  → https://dentiflow-production.up.railway.app/privacy

import { Router, type Request, type Response } from 'express';

const router = Router();

const UPDATED = 'August 4, 2026';
const CONTACT = 'trevor@dentiflow.ai';

const page = (title: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Dentiflow</title>
<style>
  :root{color-scheme:light dark}
  body{margin:0;background:#fff;color:#16192b;
    font:16px/1.65 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif}
  main{max-width:44rem;margin:0 auto;padding:56px 22px 96px}
  h1{font-size:2rem;line-height:1.15;letter-spacing:-.02em;margin:0 0 6px}
  h2{font-size:1.12rem;margin:34px 0 8px;letter-spacing:-.01em}
  .meta{color:#5c6379;font-size:.9rem;margin:0 0 30px}
  ul{padding-left:1.15rem}
  li{margin:5px 0}
  a{color:#2563eb}
  @media (prefers-color-scheme:dark){
    body{background:#0e1020;color:#e8eaf2}
    .meta{color:#8b92a8}
    a{color:#7fa6e8}
  }
</style></head><body><main>${body}</main></body></html>`;

const PRIVACY = page(
  'Privacy Policy',
  `
<h1>Privacy Policy</h1>
<p class="meta">Last updated ${UPDATED}</p>

<p>Dentiflow provides automated patient recall and appointment messaging for dental
practices. This policy explains what information we handle, why, and how to have it
removed.</p>

<h2>Information we handle</h2>
<ul>
  <li><strong>Prospective customers.</strong> If you visit our site or book a call, we
      collect the name, email, phone number and business details you provide, plus
      standard analytics such as pages viewed and the ad or link that referred you.</li>
  <li><strong>Patient data, on behalf of our clients.</strong> When a dental practice
      engages us, we process patient contact details and appointment status supplied by
      that practice, solely to send appointment and recall messages on its behalf. The
      practice is the owner of that data; we act as its service provider.</li>
</ul>

<h2>How we use it</h2>
<ul>
  <li>To send appointment reminders, recall messages and replies by SMS.</li>
  <li>To respond to enquiries and schedule calls.</li>
  <li>To measure whether our advertising and messaging work.</li>
</ul>
<p>We do not sell personal information, and we do not use patient data to advertise to
patients.</p>

<h2>Service providers</h2>
<p>We share information only with providers that help us operate: Twilio (message
delivery), Supabase (data storage), Anthropic (message drafting), Meta and Google
(advertising measurement for our own marketing), and GoHighLevel (scheduling and CRM).
Each processes data under contract and only as needed to provide its service.</p>

<h2>Text messages</h2>
<p>Message frequency varies. Reply STOP to any message to opt out; opt-outs are permanent
and we will not message that number again on behalf of that practice. Reply HELP for
assistance. Message and data rates may apply.</p>

<h2>Health information</h2>
<p>Messages we send on behalf of a practice are limited to scheduling — appointment
timing, availability and confirmation. We do not send treatment or diagnostic details.
Where a practice is a HIPAA covered entity, we act as a business associate under a
written agreement with that practice.</p>

<h2>Retention</h2>
<p>We keep prospect information for as long as needed to respond and to meet legal or
accounting obligations. Patient data is retained for the term of the practice's agreement
and deleted or returned at its request.</p>

<h2>Your choices</h2>
<p>You may request access to, correction of, or deletion of your personal information by
emailing <a href="mailto:${CONTACT}">${CONTACT}</a>. If you are a patient of one of our
client practices, contact the practice directly, or email us and we will route the
request to them.</p>

<h2>Children</h2>
<p>Our services are sold to dental practices and are not directed to children. We do not
knowingly collect information from children directly.</p>

<h2>Changes</h2>
<p>If this policy changes materially we will update the date at the top of this page.</p>

<h2>Contact</h2>
<p>Dentiflow · <a href="mailto:${CONTACT}">${CONTACT}</a></p>
`
);

router.get('/privacy', (_req: Request, res: Response) => {
  res.type('text/html').send(PRIVACY);
});

export default router;
