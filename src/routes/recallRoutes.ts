// Recall API Routes
//
// POST /api/recall/segment    — Parse CSV, segment by location/overdue. No DB writes.
// POST /api/recall/patients   — Upsert approved patients into DB.
// POST /api/recall/sequence   — Create paused sequences for approved patient IDs.
// POST /api/recall/launch     — Show count (confirm=false) or activate + send (confirm=true).
// POST /api/recall/orchestrate — Run Day 1/3 orchestrator manually.

import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { runSegmentAgent } from '../services/recall/segmentAgent';
import { runPatientAgent } from '../services/recall/patientAgent';
import { runSequenceAgent } from '../services/recall/sequenceAgent';
import { runDay0Outreach } from '../services/recall/outreachEngine';
import { runSequenceOrchestrator } from '../services/recall/sequenceOrchestrator';
import type { SegmentedRecord } from '../types/recall';

const router = Router();

// POST /api/recall/segment
// Body: { practiceId: string, csv: string }
// Returns segmentation summary — no DB writes.
router.post('/segment', async (req, res) => {
  try {
    const { practiceId, csv } = req.body;

    if (!practiceId) {
      res.status(400).json({ error: 'Missing practiceId' });
      return;
    }
    if (!csv || typeof csv !== 'string') {
      res.status(400).json({ error: 'Missing or invalid csv field' });
      return;
    }

    const result = runSegmentAgent(csv);

    res.json({
      success: true,
      eligible: result.records.length,
      skippedNextAppt: result.skippedNextAppt,
      skippedDuplicate: result.skippedDuplicate,
      skippedInvalidPhone: result.skippedInvalidPhone,
      skippedTest: result.skippedTest,
      parseErrors: result.parseErrors,
      byLocation: result.byLocation,
      byVoice: result.byVoice,
      bySegment: result.bySegment,
      records: result.records,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/recall/patients
// Body: { practiceId: string, records: SegmentedRecord[] }
// Upserts patients into DB. Returns patientIds for handoff to /sequence.
router.post('/patients', async (req, res) => {
  try {
    const { practiceId, records } = req.body;

    if (!practiceId) {
      res.status(400).json({ error: 'Missing practiceId' });
      return;
    }
    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json({ error: 'Missing or empty records array' });
      return;
    }

    const result = await runPatientAgent(practiceId, records as SegmentedRecord[]);
    res.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/recall/sequence
// Body: { practiceId: string, patientIds: string[] }
// Creates paused sequences for approved patients. Returns sequenceIds.
router.post('/sequence', async (req, res) => {
  try {
    const { practiceId, patientIds } = req.body;

    if (!practiceId) {
      res.status(400).json({ error: 'Missing practiceId' });
      return;
    }
    if (!Array.isArray(patientIds) || patientIds.length === 0) {
      res.status(400).json({ error: 'Missing or empty patientIds array' });
      return;
    }

    const result = await runSequenceAgent(practiceId, patientIds);
    res.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/recall/launch
// Body: { practiceId: string, location?: string, confirm: boolean }
// confirm=false → returns patient count only (required first step)
// confirm=true  → activates sequences + sends Day 0 at 1 msg/sec
router.post('/launch', async (req, res) => {
  try {
    const { practiceId, location, confirm } = req.body;

    if (!practiceId) {
      res.status(400).json({ error: 'Missing practiceId' });
      return;
    }

    // Build base query for paused Day 0 sequences
    let countQuery = supabase
      .from('recall_sequences')
      .select('id', { count: 'exact', head: true })
      .eq('practice_id', practiceId)
      .eq('sequence_status', 'paused')
      .eq('sequence_day', 0)
      .is('last_sent_at', null);

    // If location filter provided, join through patients table
    if (location) {
      const { data: locationPatients } = await supabase
        .from('patients')
        .select('id')
        .eq('practice_id', practiceId)
        .ilike('location', `%${location}%`);

      const locationPatientIds = (locationPatients || []).map((p: any) => p.id);
      if (locationPatientIds.length === 0) {
        res.status(200).json({
          requiresConfirmation: true,
          patientCount: 0,
          location,
          message: `No patients found for location "${location}"`,
        });
        return;
      }
      countQuery = countQuery.in('patient_id', locationPatientIds);
    }

    const { count, error: countErr } = await countQuery;

    if (countErr) {
      res.status(500).json({ error: countErr.message });
      return;
    }

    const patientCount = count ?? 0;

    if (!confirm) {
      res.status(200).json({
        requiresConfirmation: true,
        patientCount,
        location: location || 'all',
        message: `This will send SMS to ${patientCount} patients${location ? ` at ${location}` : ''}. Resubmit with confirm=true to proceed.`,
      });
      return;
    }

    if (patientCount === 0) {
      res.status(400).json({ error: 'No paused Day 0 sequences found. Run /patients and /sequence first.' });
      return;
    }

    // Activate paused sequences
    let activateQuery = supabase
      .from('recall_sequences')
      .update({ sequence_status: 'active' })
      .eq('practice_id', practiceId)
      .eq('sequence_status', 'paused')
      .eq('sequence_day', 0)
      .is('last_sent_at', null);

    if (location) {
      const { data: locationPatients } = await supabase
        .from('patients')
        .select('id')
        .eq('practice_id', practiceId)
        .ilike('location', `%${location}%`);

      const ids = (locationPatients || []).map((p: any) => p.id);
      activateQuery = activateQuery.in('patient_id', ids);
    }

    const { error: activateErr } = await activateQuery;

    if (activateErr) {
      res.status(500).json({ error: activateErr.message });
      return;
    }

    // Send at 1 msg/sec (rate limit enforced inside runDay0Outreach)
    const outreach = await runDay0Outreach(practiceId);
    res.json({ success: true, patientCount, location: location || 'all', outreach });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[recallRoutes] Launch error:', msg);
    res.status(500).json({ error: msg });
  }
});

// POST /api/recall/orchestrate
// Body: { practiceId: string, location?: string }
router.post('/orchestrate', async (req, res) => {
  try {
    const { practiceId, location } = req.body;

    if (!practiceId) {
      res.status(400).json({ error: 'Missing practiceId' });
      return;
    }

    const result = await runSequenceOrchestrator(practiceId, location ? { location } : undefined);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[recallRoutes] Orchestrate error:', msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
