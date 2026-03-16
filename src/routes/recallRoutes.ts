// Recall API Routes
// POST /api/recall/ingest — Import patients for recall
// POST /api/recall/outreach — Trigger Day 0 outreach
// POST /api/recall/orchestrate — Run sequence orchestrator (Day 1/3, auto-exit, re-entry)

import { Router } from 'express';
import { ingestPatients } from '../services/recall/ingestAgent';
import { runDay0Outreach } from '../services/recall/outreachEngine';
import { runSequenceOrchestrator } from '../services/recall/sequenceOrchestrator';
import type { IngestRecord } from '../services/recall/ingestAgent';

const router = Router();

// POST /api/recall/ingest
// Body: { practiceId: string, patients: IngestRecord[] }
router.post('/ingest', async (req, res) => {
  try {
    const { practiceId, patients } = req.body;

    if (!practiceId || !patients || !Array.isArray(patients)) {
      res.status(400).json({ error: 'Missing practiceId or patients array' });
      return;
    }

    const result = await ingestPatients(practiceId, patients as IngestRecord[]);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[recallRoutes] Ingest error:', msg);
    res.status(500).json({ error: msg });
  }
});

// POST /api/recall/outreach
// Body: { practiceId: string }
router.post('/outreach', async (req, res) => {
  try {
    const { practiceId } = req.body;

    if (!practiceId) {
      res.status(400).json({ error: 'Missing practiceId' });
      return;
    }

    const result = await runDay0Outreach(practiceId);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[recallRoutes] Outreach error:', msg);
    res.status(500).json({ error: msg });
  }
});

// POST /api/recall/orchestrate
// Body: { practiceId: string }
router.post('/orchestrate', async (req, res) => {
  try {
    const { practiceId } = req.body;

    if (!practiceId) {
      res.status(400).json({ error: 'Missing practiceId' });
      return;
    }

    const result = await runSequenceOrchestrator(practiceId);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[recallRoutes] Orchestrate error:', msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
