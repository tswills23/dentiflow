import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { smsWebhook } from './routes/smsWebhook';
import { formWebhook } from './routes/formWebhook';
import { missedCallWebhook } from './routes/missedCallWebhook';
import recallRoutes from './routes/recallRoutes';
import reviewRoutes from './routes/reviewRoutes';
import noshowRoutes from './routes/noshowRoutes';
import appointmentRoutes from './routes/appointmentRoutes';
import pmsWebhookRoutes from './routes/pmsWebhookRoutes';
import bookingRedirectRoute from './routes/bookingRedirectRoute';
import { startRecallCron } from './services/recall/recallCron';
import { startReviewCron } from './services/reviews/reviewCronScheduler';
import { startNoshowCron } from './services/noshow/noshowCron';
import { startPmsSyncCron } from './services/pms/pmsSyncCron';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true })); // Twilio sends form-encoded

// Request logging (debug)
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.path} | Content-Type: ${req.headers['content-type']} | Body keys: ${Object.keys(req.body || {}).join(', ')}`);
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'dentiflow-stl', timestamp: new Date().toISOString() });
});

// Webhook routes
app.post('/webhooks/sms', smsWebhook);
app.post('/webhooks/form', formWebhook);
app.post('/webhooks/missed-call', missedCallWebhook);
app.use('/webhooks/pms', pmsWebhookRoutes);

// Recall API routes
app.use('/api/recall', recallRoutes);

// Review & Referral API routes
app.use('/api/reviews', reviewRoutes);

// No-Show Recovery API routes
app.use('/api/noshow', noshowRoutes);

// Appointment API routes (complete → auto-trigger review)
app.use('/api/appointments', appointmentRoutes);

// Booking link redirect (click-tracked for reactivation SMS)
app.use('/r', bookingRedirectRoute);

// Referral landing page (public, serves HTML)
app.get('/ref/:hash', (_req, res) => {
  res.type('text/html').send(getReferralPageHTML());
});

app.listen(PORT, () => {
  console.log(`[DentiFlow STL] Server running on port ${PORT}`);
  console.log(`[DentiFlow STL] SMS_LIVE_MODE: ${process.env.SMS_LIVE_MODE || 'false'}`);

  // Start recall cron (hourly sequence orchestrator)
  if (process.env.RECALL_CRON_ENABLED !== 'false') {
    startRecallCron();
  } else {
    console.log('[DentiFlow STL] Recall cron disabled (RECALL_CRON_ENABLED=false)');
  }

  // Start review cron (hourly review sequence orchestrator)
  if (process.env.REVIEW_CRON_ENABLED !== 'false') {
    startReviewCron();
  } else {
    console.log('[DentiFlow STL] Review cron disabled (REVIEW_CRON_ENABLED=false)');
  }

  // Start no-show recovery cron (hourly, offset at :05)
  if (process.env.NOSHOW_CRON_ENABLED !== 'false') {
    startNoshowCron();
  } else {
    console.log('[DentiFlow STL] No-show cron disabled (NOSHOW_CRON_ENABLED=false)');
  }

  // Start PMS sync cron (hourly, offset at :10)
  if (process.env.PMS_SYNC_CRON_ENABLED !== 'false') {
    startPmsSyncCron();
  } else {
    console.log('[DentiFlow STL] PMS sync cron disabled (PMS_SYNC_CRON_ENABLED=false)');
  }
});

// Referral landing page — self-contained HTML (no separate frontend build needed)
function getReferralPageHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've Been Referred!</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #0C0F12; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #1A2028; border-radius: 16px; padding: 40px; max-width: 420px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
    h1 { font-size: 24px; font-weight: 600; margin-bottom: 8px; color: #34D399; }
    .subtitle { color: #9CA3AF; font-size: 15px; margin-bottom: 24px; line-height: 1.5; }
    .offer { background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.2); border-radius: 10px; padding: 14px 18px; margin-bottom: 24px; font-size: 14px; color: #34D399; }
    label { display: block; font-size: 13px; color: #9CA3AF; margin-bottom: 6px; font-weight: 500; }
    input { width: 100%; padding: 12px 14px; background: #151A1F; border: 1px solid #2D3748; border-radius: 8px; color: #fff; font-size: 15px; outline: none; margin-bottom: 16px; }
    input:focus { border-color: #34D399; }
    button { width: 100%; padding: 14px; background: #34D399; color: #0C0F12; font-size: 16px; font-weight: 600; border: none; border-radius: 10px; cursor: pointer; transition: opacity 0.15s; }
    button:hover { opacity: 0.9; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .success { text-align: center; }
    .success h2 { font-size: 20px; margin-bottom: 12px; color: #34D399; }
    .success p { color: #9CA3AF; font-size: 15px; line-height: 1.5; }
    .error { color: #F87171; font-size: 13px; margin-bottom: 12px; }
    .loading { display: inline-block; width: 18px; height: 18px; border: 2px solid #0C0F12; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; vertical-align: middle; margin-right: 8px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card" id="formCard">
    <h1 id="practiceName">Loading...</h1>
    <p class="subtitle" id="subtitle"></p>
    <div class="offer" id="offerBox" style="display:none"></div>
    <form id="referralForm" style="display:none">
      <label for="name">Your Name</label>
      <input type="text" id="name" name="name" placeholder="Jane Smith" required>
      <label for="phone">Phone Number</label>
      <input type="tel" id="phone" name="phone" placeholder="(555) 123-4567" required>
      <div class="error" id="errorMsg" style="display:none"></div>
      <button type="submit" id="submitBtn">Get Started</button>
    </form>
    <div class="success" id="successMsg" style="display:none">
      <h2>You're all set!</h2>
      <p id="successText"></p>
    </div>
  </div>
  <script>
    const hash = window.location.pathname.split('/ref/')[1];
    const API_BASE = window.location.origin;

    async function loadReferral() {
      try {
        const res = await fetch(API_BASE + '/api/reviews/referral/' + hash);
        if (!res.ok) { document.getElementById('practiceName').textContent = 'Link not found'; return; }
        const data = await res.json();
        document.getElementById('practiceName').textContent = data.practiceName;
        document.getElementById('subtitle').textContent = data.referrerFirstName + ' thought you would love us. We would love to meet you!';
        if (data.referralOffer) {
          document.getElementById('offerBox').style.display = 'block';
          document.getElementById('offerBox').textContent = 'Your referral perk: ' + data.referralOffer;
        }
        document.getElementById('referralForm').style.display = 'block';
      } catch (e) {
        document.getElementById('practiceName').textContent = 'Something went wrong';
      }
    }

    document.getElementById('referralForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      var btn = document.getElementById('submitBtn');
      var err = document.getElementById('errorMsg');
      btn.disabled = true;
      btn.innerHTML = '<span class="loading"></span>Submitting...';
      err.style.display = 'none';

      try {
        var res = await fetch(API_BASE + '/api/reviews/referral-submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hash: hash, name: document.getElementById('name').value, phone: document.getElementById('phone').value })
        });
        var data = await res.json();
        if (!res.ok || !data.success) { throw new Error(data.error || 'Submission failed'); }
        document.getElementById('referralForm').style.display = 'none';
        document.getElementById('offerBox').style.display = 'none';
        document.getElementById('successMsg').style.display = 'block';
        document.getElementById('successText').textContent = 'Thanks! The team at ' + data.practiceName + ' will reach out shortly.';
      } catch (error) {
        err.textContent = error.message;
        err.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Get Started';
      }
    });

    loadReferral();
  </script>
</body>
</html>`;
}

export default app;
