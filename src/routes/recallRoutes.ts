// Recall API Routes
// POST /api/recall/import — Parse CSV + ingest (no outreach)
// POST /api/recall/launch — Trigger Day 0 outreach for reviewed patients
// POST /api/recall/orchestrate — Run sequence orchestrator (Day 1/3, auto-exit, re-entry)

import { Router } from 'express';
import { ingestPatients } from '../services/recall/ingestAgent';
import { runDay0Outreach } from '../services/recall/outreachEngine';
import { runSequenceOrchestrator } from '../services/recall/sequenceOrchestrator';
import { parseRecallCsv } from '../services/recall/csvParser';

const router = Router();

// POST /api/recall/import
// Body: { practiceId: string, csv: string }
// Parse CSV → ingest patients. No outreach. Review output before launching.
router.post('/import', async (req, res) => {
  try {
    const { practiceId, csv } = req.body;

    if (!practiceId) {
      res.status(400).json({ error: 'Missing practiceId' });
      return;
    }
    if (!csv || typeof csv !== 'string') {
      res.status(400).json({ error: 'Missing or invalid csv field (expected string)' });
      return;
    }

    // Phase 1: Parse CSV
    const parseResult = parseRecallCsv(csv);

    if (parseResult.records.length === 0) {
      res.status(400).json({
        error: 'No valid records found in CSV',
        csvErrors: parseResult.errors,
        csvSkipped: parseResult.skipped,
      });
      return;
    }

    // Phase 2: Ingest (no outreach)
    const ingestResult = await ingestPatients(practiceId, parseResult.records);

    res.json({
      success: true,
      csv: {
        parsed: parseResult.records.length,
        skipped: parseResult.skipped,
        errors: parseResult.errors,
      },
      ingest: ingestResult,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[recallRoutes] Import error:', msg);
    res.status(500).json({ error: msg });
  }
});

// POST /api/recall/launch
// Body: { practiceId: string }
// Trigger Day 0 outreach for imported patients. Call after reviewing /import output.
router.post('/launch', async (req, res) => {
  try {
    const { practiceId } = req.body;

    if (!practiceId) {
      res.status(400).json({ error: 'Missing practiceId' });
      return;
    }

    const result = await runDay0Outreach(practiceId);
    res.json({ success: true, outreach: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[recallRoutes] Launch error:', msg);
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
