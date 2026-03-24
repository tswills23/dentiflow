import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { smsWebhook } from './routes/smsWebhook';
import { formWebhook } from './routes/formWebhook';
import { missedCallWebhook } from './routes/missedCallWebhook';
import recallRoutes from './routes/recallRoutes';
import { startRecallCron } from './services/recall/recallCron';

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

// Recall API routes
app.use('/api/recall', recallRoutes);

app.listen(PORT, () => {
  console.log(`[DentiFlow STL] Server running on port ${PORT}`);
  console.log(`[DentiFlow STL] SMS_LIVE_MODE: ${process.env.SMS_LIVE_MODE || 'false'}`);

  // Start recall cron (hourly sequence orchestrator)
  if (process.env.RECALL_CRON_ENABLED !== 'false') {
    startRecallCron();
  } else {
    console.log('[DentiFlow STL] Recall cron disabled (RECALL_CRON_ENABLED=false)');
  }
});

export default app;
