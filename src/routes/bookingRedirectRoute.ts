// Booking Link Redirect — Click-tracked redirect for reactivation SMS
//
// GET /r/:token → log click → 302 redirect to practice booking URL
//
// Each reactivation SMS contains a unique tracked link. When the patient
// clicks it, we log the click timestamp on the sequence and redirect
// to the practice's Dentrix Ascend online scheduling page.

import { Router, type Request, type Response } from 'express';
import { supabase } from '../lib/supabase';
import { logAutomation } from '../services/execution/metricsTracker';

const router = Router();

router.get('/:token', async (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    // 1. Look up sequence by booking link token
    const { data: seq, error } = await supabase
      .from('recall_sequences')
      .select('id, practice_id, patient_id, link_clicked_at')
      .eq('booking_link_token', token as string)
      .single();

    if (error || !seq) {
      console.warn(`[bookingRedirect] Unknown token: ${token}`);
      res.status(404).send('Link not found');
      return;
    }

    // 2. Record click (only first click updates timestamp)
    if (!seq.link_clicked_at) {
      await supabase
        .from('recall_sequences')
        .update({ link_clicked_at: new Date().toISOString() })
        .eq('id', seq.id);

      // Increment metric
      await supabase.rpc('increment_recall_metric', {
        p_practice_id: seq.practice_id,
        p_date: new Date().toISOString().split('T')[0],
        p_field: 'recall_links_clicked',
      });

      // Log automation event
      await logAutomation({
        practiceId: seq.practice_id,
        patientId: seq.patient_id,
        automationType: 'recall',
        action: 'link_click',
        result: 'clicked',
        metadata: { token, sequenceId: seq.id },
      });

      console.log(`[bookingRedirect] Click logged for sequence ${seq.id}`);
    }

    // 3. Get practice booking URL
    const { data: practice } = await supabase
      .from('practices')
      .select('booking_url, website')
      .eq('id', seq.practice_id)
      .single();

    const redirectUrl = practice?.booking_url || practice?.website || 'https://www.google.com';

    // 4. Redirect to booking page
    res.redirect(302, redirectUrl);
  } catch (err) {
    console.error('[bookingRedirect] Error:', err);
    res.status(500).send('Something went wrong');
  }
});

export default router;
