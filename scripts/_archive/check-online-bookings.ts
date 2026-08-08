import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// From Dentrix "Appointments Booked Online" report 5/12-7/31
const ONLINE_BOOKINGS = [
  { bookedOn: '05/18/2026', apptDate: '05/20/2026', first: 'Amanda', last: 'Riesterer' },
  { bookedOn: '04/25/2026', apptDate: '05/30/2026', first: 'Kelly', last: 'Cuevas' },
  { bookedOn: '05/04/2026', apptDate: '05/30/2026', first: 'Maya', last: 'Muhammad' },
  { bookedOn: '05/14/2026', apptDate: '06/02/2026', first: 'Myles', last: 'Harris' },
  { bookedOn: '05/14/2026', apptDate: '06/11/2026', first: 'Christine', last: 'Harris' },
  { bookedOn: '05/14/2026', apptDate: '06/11/2026', first: 'Mariah', last: 'Muhammad' }, // "Miss Mariah" - investigate
  { bookedOn: '05/09/2026', apptDate: '06/13/2026', first: 'Alexis', last: 'Manzara' },
  { bookedOn: '05/14/2026', apptDate: '06/13/2026', first: 'Fard', last: 'Muhammad' },
  { bookedOn: '05/17/2026', apptDate: '06/20/2026', first: 'Brandon', last: 'Soriano', newPatient: true },
  { bookedOn: '05/18/2026', apptDate: '07/11/2026', first: 'Julia', last: 'Gulik', newPatient: true },
];

function norm(s: string): string { return (s || '').trim().toLowerCase().replace(/[^a-z]/g, ''); }

async function main() {
  const { data: seqs } = await sb
    .from('recall_sequences')
    .select('experiment_arm, patient_id, link_clicked_at, booking_stage')
    .in('experiment_arm', ['control_voice', 'offer_only'])
    .limit(2000);
  if (!seqs) return;
  const patIds = seqs.map(s => s.patient_id);
  const chunk = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i=0;i<a.length;i+=n) o.push(a.slice(i,i+n)); return o; };
  const pats: any[] = [];
  for (const c of chunk(patIds, 100)) {
    const { data } = await sb.from('patients').select('id, first_name, last_name, phone').in('id', c);
    if (data) pats.push(...data);
  }
  const patById = new Map(pats.map(p => [p.id, p]));

  type AB = { arm: string; first: string; last: string; phone: string; clicked: boolean };
  const byName = new Map<string, AB>();
  seqs.forEach(s => {
    const p = patById.get(s.patient_id);
    if (!p?.first_name || !p?.last_name) return;
    const key = `${norm(p.first_name)}|${norm(p.last_name)}`;
    byName.set(key, {
      arm: s.experiment_arm,
      first: p.first_name, last: p.last_name, phone: p.phone || '',
      clicked: !!s.link_clicked_at,
    });
  });

  console.log('\n=== Online bookings cross-referenced against 400 A/B test patients ===\n');
  console.log('Booked On  | Appt Date  | Patient                | In A/B Test? | Arm | Link Clicked?');
  console.log('-----------|------------|------------------------|--------------|-----|---------------');
  let matched = 0, armA = 0, armB = 0;
  for (const b of ONLINE_BOOKINGS) {
    const key = `${norm(b.first)}|${norm(b.last)}`;
    const ab = byName.get(key);
    if (ab) {
      matched++;
      if (ab.arm === 'control_voice') armA++;
      else armB++;
      console.log(`${b.bookedOn} | ${b.apptDate} | ${b.first.padEnd(10)} ${b.last.padEnd(11)} | YES          | ${ab.arm === 'control_voice' ? 'A' : 'B'}   | ${ab.clicked ? 'YES' : 'NO'}`);
    } else {
      // Try last-name-only fallback
      const lastMatches: AB[] = [];
      for (const [k, v] of byName.entries()) {
        if (k.endsWith('|' + norm(b.last))) lastMatches.push(v);
      }
      const newTag = (b as any).newPatient ? ' [new patient in Dentrix]' : '';
      if (lastMatches.length) {
        console.log(`${b.bookedOn} | ${b.apptDate} | ${b.first.padEnd(10)} ${b.last.padEnd(11)} | NO exact, but ${lastMatches.length} same-surname in test${newTag}`);
        lastMatches.forEach(m => console.log(`           |            |                        |   -> test patient: ${m.first} ${m.last} (Arm ${m.arm === 'control_voice' ? 'A' : 'B'}, clicked=${m.clicked})`));
      } else {
        console.log(`${b.bookedOn} | ${b.apptDate} | ${b.first.padEnd(10)} ${b.last.padEnd(11)} | NO           |     |${newTag}`);
      }
    }
  }
  console.log(`\nTotal online bookings: ${ONLINE_BOOKINGS.length}`);
  console.log(`Exact name match in test list: ${matched} (Arm A: ${armA}, Arm B: ${armB})`);
}
main().catch(e => { console.error(e); process.exit(1); });
