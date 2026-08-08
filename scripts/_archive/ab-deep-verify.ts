import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import 'dotenv/config';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const CSV = "c:/Users/tswil/Dentiflow speed to lead/Interactive+Schedule+Report+Builder.csv";
const LAUNCH = new Date('2026-05-12T00:00:00Z');

function normPhone(s: string): string { return (s || '').replace(/\D/g, '').slice(-10); }
function normName(s: string): string { return (s || '').trim().toLowerCase().replace(/[^a-z]/g, ''); }

const NICKNAMES: Record<string, string[]> = {
  robert: ['rob', 'bob', 'bobby', 'robbie'],
  william: ['will', 'bill', 'billy', 'willy'],
  michael: ['mike', 'mick'],
  richard: ['rick', 'rich', 'dick'],
  james: ['jim', 'jimmy', 'jamie'],
  joseph: ['joe', 'joey', 'jose'],
  john: ['jack', 'johnny', 'jon'],
  thomas: ['tom', 'tommy'],
  charles: ['chuck', 'charlie', 'chas'],
  daniel: ['dan', 'danny'],
  matthew: ['matt', 'matty'],
  anthony: ['tony'],
  christopher: ['chris', 'topher', 'kit'],
  nicholas: ['nick', 'nicky'],
  alexander: ['alex', 'xander', 'sasha'],
  benjamin: ['ben', 'benny'],
  jonathan: ['jon', 'jonny', 'john'],
  patrick: ['pat', 'patty'],
  edward: ['ed', 'eddie', 'ted', 'teddy'],
  david: ['dave', 'davey'],
  samuel: ['sam', 'sammy'],
  steven: ['steve', 'stevie'],
  stephen: ['steve', 'stevie'],
  andrew: ['andy', 'drew'],
  ronald: ['ron', 'ronny'],
  donald: ['don', 'donny'],
  kenneth: ['ken', 'kenny'],
  timothy: ['tim', 'timmy'],
  jeffrey: ['jeff', 'jeffy'],
  gregory: ['greg', 'gregg'],
  douglas: ['doug', 'dougie'],
  raymond: ['ray'],
  lawrence: ['larry', 'lar'],
  frederick: ['fred', 'freddy', 'rick', 'ricky'],
  henry: ['hank', 'harry'],
  philip: ['phil'],
  phillip: ['phil'],
  vincent: ['vince', 'vinny'],
  francis: ['frank', 'frankie', 'fran'],
  walter: ['walt', 'wally'],
  arthur: ['art', 'artie'],
  harold: ['harry', 'hal'],
  rafael: ['rafa', 'raphy'],
  catherine: ['cathy', 'kate', 'katie', 'kat', 'cat'],
  katherine: ['cathy', 'kate', 'katie', 'kat', 'cat'],
  elizabeth: ['liz', 'beth', 'betty', 'eliza', 'liza', 'libby'],
  margaret: ['maggie', 'meg', 'peggy', 'marge'],
  patricia: ['pat', 'patty', 'tricia', 'trish'],
  jennifer: ['jen', 'jenny', 'jenn'],
  jessica: ['jess', 'jessie'],
  amanda: ['mandy'],
  stephanie: ['steph', 'stephie'],
  nicole: ['nikki'],
  michelle: ['shelly'],
  rebecca: ['becky', 'becca'],
  rachel: ['rae'],
  samantha: ['sam', 'sammy'],
  victoria: ['vicky', 'tori', 'vic'],
  alexandra: ['alex', 'allie', 'sasha', 'sandy'],
  christina: ['chris', 'tina', 'christy'],
  christine: ['chris', 'christy', 'tina'],
  cynthia: ['cindy'],
  deborah: ['deb', 'debbie'],
  dorothy: ['dot', 'dottie'],
  evelyn: ['eve', 'evie'],
  frances: ['fran', 'frannie'],
  judith: ['judy'],
  julia: ['julie'],
  laura: ['laurie'],
  lisa: ['liz'],
  melissa: ['mel', 'missy', 'lissa'],
  pamela: ['pam'],
  sarah: ['sara'],
  susan: ['sue', 'susie', 'suzy'],
  teresa: ['terry', 'teri', 'tess'],
  theresa: ['terry', 'teri', 'tess', 'tracy'],
  virginia: ['ginny', 'ginger', 'gina'],
  guadalupe: ['lupe', 'lupita'],
  conchita: ['concha', 'connie'],
};

function nameVariants(name: string): string[] {
  const n = normName(name);
  const out = new Set<string>([n]);
  if (NICKNAMES[n]) NICKNAMES[n].forEach(v => out.add(v));
  for (const [formal, nicks] of Object.entries(NICKNAMES)) {
    if (nicks.includes(n)) {
      out.add(formal);
      nicks.forEach(v => out.add(v));
    }
  }
  return Array.from(out);
}

function firstNameMatches(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = normName(a), nb = normName(b);
  if (na === nb) return true;
  if (na.length >= 3 && nb.length >= 3 && (na.startsWith(nb) || nb.startsWith(na))) return true;
  const va = nameVariants(a), vb = nameVariants(b);
  return va.some(x => vb.includes(x));
}

function lastNameMatches(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = normName(a), nb = normName(b);
  if (na === nb) return true;
  if (na.length >= 3 && nb.length >= 3) {
    if (na.includes(nb) || nb.includes(na)) return true;
  }
  return false;
}

async function main() {
  const { data: seqs } = await sb
    .from('recall_sequences')
    .select('experiment_arm, patient_id, link_clicked_at, booking_stage, exit_reason')
    .in('experiment_arm', ['control_voice', 'offer_only'])
    .limit(2000);
  if (!seqs) return;
  const patIds = seqs.map(s => s.patient_id);
  const chunk = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
  const pats: any[] = [];
  for (const c of chunk(patIds, 100)) {
    const { data } = await sb.from('patients').select('id, first_name, last_name, phone, recall_opt_out').in('id', c);
    if (data) pats.push(...data);
  }
  const patById = new Map(pats.map(p => [p.id, p]));

  type AB = {
    arm: string; first: string; last: string; phone: string;
    clicked: boolean; bookingStage: string; exitReason: string | null;
    optOut: boolean; patientId: string;
  };
  const phoneToAB = new Map<string, AB>();
  seqs.forEach(s => {
    const p = patById.get(s.patient_id);
    if (!p?.phone) return;
    phoneToAB.set(normPhone(p.phone), {
      arm: s.experiment_arm,
      first: p.first_name || '', last: p.last_name || '',
      phone: p.phone,
      clicked: !!s.link_clicked_at,
      bookingStage: s.booking_stage || '',
      exitReason: s.exit_reason,
      optOut: !!p.recall_opt_out,
      patientId: s.patient_id,
    });
  });

  const text = readFileSync(CSV, 'utf8');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  let hdrIdx = 0;
  for (let i = 0; i < 20; i++) {
    if (lines[i].toLowerCase().includes('phone') || lines[i].toLowerCase().includes('first name')) { hdrIdx = i; break; }
  }
  const headers = lines[hdrIdx].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const fnIdx = headers.indexOf('first name');
  const lnIdx = headers.indexOf('last name');
  const phIdx = headers.indexOf('phone');
  const dtIdx = headers.indexOf('appt date');
  const stIdx = headers.indexOf('appt status');

  type MatchRow = {
    arm: string;
    abFirst: string; abLast: string; abPhone: string;
    csvFirst: string; csvLast: string;
    apptDate: string; status: string;
    confidence: 'EXACT' | 'NICKNAME' | 'LAST_ONLY' | 'PHONE_ONLY';
    notes: string[];
    clicked: boolean;
    bookingStage: string;
    optOut: boolean;
  };
  const allMatches: MatchRow[] = [];

  for (let i = hdrIdx + 1; i < lines.length; i++) {
    const cells: string[] = [];
    let cur = '', inQ = false;
    for (const ch of lines[i]) {
      if (ch === '"') inQ = !inQ;
      else if (ch === ',' && !inQ) { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);

    const phone = normPhone(cells[phIdx] || '');
    if (!phone) continue;
    const ab = phoneToAB.get(phone);
    if (!ab) continue;

    const csvFirst = cells[fnIdx] || '';
    const csvLast = cells[lnIdx] || '';
    const apptDate = cells[dtIdx] || '';
    const d = new Date(apptDate);
    if (isNaN(d.getTime()) || d < LAUNCH) continue;

    const fnExact = normName(ab.first) === normName(csvFirst);
    const lnExact = normName(ab.last) === normName(csvLast);
    const fnMatch = firstNameMatches(ab.first, csvFirst);
    const lnMatch = lastNameMatches(ab.last, csvLast);

    let confidence: MatchRow['confidence'];
    const notes: string[] = [];
    if (fnExact && lnExact) confidence = 'EXACT';
    else if (fnMatch && lnMatch) { confidence = 'NICKNAME'; notes.push(`Nickname/variant: ${ab.first}/${ab.last} -> ${csvFirst}/${csvLast}`); }
    else if (lnMatch && !fnMatch) { confidence = 'LAST_ONLY'; notes.push(`Same surname, different first name - likely family member`); }
    else { confidence = 'PHONE_ONLY'; notes.push(`Phone match only, surname differs - almost certainly different person`); }

    if (ab.clicked) notes.push('CLICKED our booking link');
    if (ab.bookingStage === 'S6_COMPLETED') notes.push('Reached booking-intent state in our chat');
    if (ab.optOut) notes.push('Test patient opted out - investigate');

    allMatches.push({
      arm: ab.arm,
      abFirst: ab.first, abLast: ab.last, abPhone: ab.phone,
      csvFirst, csvLast, apptDate, status: cells[stIdx] || '',
      confidence, notes,
      clicked: ab.clicked, bookingStage: ab.bookingStage, optOut: ab.optOut,
    });
  }

  const RANK: Record<MatchRow['confidence'], number> = { EXACT: 0, NICKNAME: 1, LAST_ONLY: 2, PHONE_ONLY: 3 };
  const byPhone = new Map<string, MatchRow>();
  for (const m of allMatches) {
    const existing = byPhone.get(m.abPhone);
    if (!existing) { byPhone.set(m.abPhone, m); continue; }
    if (RANK[m.confidence] < RANK[existing.confidence]) byPhone.set(m.abPhone, m);
    else if (RANK[m.confidence] === RANK[existing.confidence]) {
      if (new Date(m.apptDate) < new Date(existing.apptDate)) byPhone.set(m.abPhone, m);
    }
  }

  const stats: Record<string, Record<string, number>> = {
    control_voice: { EXACT: 0, NICKNAME: 0, LAST_ONLY: 0, PHONE_ONLY: 0 },
    offer_only: { EXACT: 0, NICKNAME: 0, LAST_ONLY: 0, PHONE_ONLY: 0 },
  };
  for (const m of byPhone.values()) stats[m.arm][m.confidence]++;

  console.log('\n=========================================================');
  console.log('  DEEP VERIFICATION - Village Dental A/B Test Bookings');
  console.log('  CSV: Dentrix Interactive Schedule Report (no Created Date)');
  console.log('=========================================================\n');

  for (const arm of ['control_voice', 'offer_only']) {
    const s = stats[arm];
    const armLabel = arm === 'control_voice' ? 'ARM A - 3-voice sequence (201 sent)' : 'ARM B - single-send offer (199 sent)';
    console.log(`\n${armLabel}`);
    console.log(`---------------------------------------------------`);
    console.log(`  EXACT match      (first + last name perfect): ${s.EXACT}`);
    console.log(`  NICKNAME match   (e.g. Liz<->Elizabeth):      ${s.NICKNAME}`);
    console.log(`  LAST_ONLY match  (same surname, diff first):  ${s.LAST_ONLY}  <-- likely family member`);
    console.log(`  PHONE_ONLY match (different name + surname):  ${s.PHONE_ONLY}  <-- shared phone, different person`);
    console.log('');
    const confirmed = s.EXACT + s.NICKNAME;
    console.log(`  DEFENSIBLE BOOKED (Exact + Nickname): ${confirmed}`);
  }

  console.log(`\n\n========== DETAIL: EXACT + NICKNAME MATCHES (defensible) ==========\n`);
  const sorted = Array.from(byPhone.values()).filter(m => m.confidence === 'EXACT' || m.confidence === 'NICKNAME');
  sorted.sort((a, b) => a.arm.localeCompare(b.arm) || a.abLast.localeCompare(b.abLast));
  for (const m of sorted) {
    const armShort = m.arm === 'control_voice' ? 'A' : 'B';
    console.log(`[Arm ${armShort}] ${m.abFirst} ${m.abLast}`);
    console.log(`        Phone:    ${m.abPhone}`);
    console.log(`        CSV name: ${m.csvFirst} ${m.csvLast}  (${m.confidence})`);
    console.log(`        Appt:     ${m.apptDate}  Status: ${m.status}`);
    m.notes.forEach(n => console.log(`        ${n}`));
    console.log('');
  }

  console.log(`\n========== EXCLUDED: LAST_ONLY + PHONE_ONLY (likely different person) ==========\n`);
  const excluded = Array.from(byPhone.values()).filter(m => m.confidence !== 'EXACT' && m.confidence !== 'NICKNAME');
  excluded.sort((a, b) => a.arm.localeCompare(b.arm));
  for (const m of excluded) {
    const armShort = m.arm === 'control_voice' ? 'A' : 'B';
    console.log(`[Arm ${armShort}] Texted: ${m.abFirst} ${m.abLast}  ->  CSV booked: ${m.csvFirst} ${m.csvLast}  [${m.confidence}]  appt=${m.apptDate}`);
  }

  const clickedAndBookedExact = sorted.filter(m => m.clicked);
  console.log(`\n\n========== STRONGEST EVIDENCE: clicked link + name match ==========\n`);
  for (const m of clickedAndBookedExact) {
    const armShort = m.arm === 'control_voice' ? 'A' : 'B';
    console.log(`[Arm ${armShort}] ${m.abFirst} ${m.abLast} - clicked + booked ${m.apptDate} (${m.status})`);
  }
  console.log(`\nTotal bulletproof attributions: ${clickedAndBookedExact.length}\n`);
}
main().catch(e => { console.error(e); process.exit(1); });
