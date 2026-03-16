import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { smsWebhook } from './routes/smsWebhook';
import { formWebhook } from './routes/formWebhook';
import { missedCallWebhook } from './routes/missedCallWebhook';
import recallRoutes from './routes/recallRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Twilio sends form-encoded

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
});

export default app;
