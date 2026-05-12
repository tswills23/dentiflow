import { classifyIntent, classifyCriticalIntent } from '../src/services/recall/intentClassifier';

const cases: Array<[string, any, string]> = [
  // Should still be opt_out
  ['Stop', 'S1_INTENT', 'opt_out'],
  ['STOP', 'S1_INTENT', 'opt_out'],
  ['stop.', 'S1_INTENT', 'opt_out'],
  ['Stop!', 'S1_INTENT', 'opt_out'],
  ['Unsubscribe', 'S1_INTENT', 'opt_out'],
  ['Cancel', 'S1_INTENT', 'opt_out'],
  ['END', 'S1_INTENT', 'opt_out'],
  ['quit', 'S1_INTENT', 'opt_out'],
  ['Stop texting me', 'S1_INTENT', 'opt_out'],
  ['Please stop messaging me', 'S1_INTENT', 'opt_out'],
  ['Take me off the list', 'S1_INTENT', 'opt_out'],
  ['Leave me alone', 'S1_INTENT', 'opt_out'],
  // Should NOT be opt_out (the bug cases)
  ['Could I stop in on Thursday to have a chat?', 'S1_INTENT', 'NOT opt_out'],
  ['Neither right now. Maybe at end of month.', 'S3_TIME_PREF', 'NOT opt_out'],
  ['Cancel my appointment please', 'S1_INTENT', 'NOT opt_out'],
  ['Could you end this with a call?', 'S1_INTENT', 'NOT opt_out'],
  ['I might stop in next week', 'S1_INTENT', 'NOT opt_out'],
];

let pass = 0, fail = 0;
for (const [text, stage, expected] of cases) {
  const r = classifyIntent(text, stage);
  const c = classifyCriticalIntent(text, stage);
  const isOptOut = r.intent === 'opt_out' || c?.intent === 'opt_out';
  const want = expected === 'opt_out';
  const ok = isOptOut === want;
  if (ok) pass++; else fail++;
  console.log((ok ? 'PASS' : 'FAIL'), '"' + text + '"', '→', r.intent, '(critical:', c?.intent || 'none', ') | expected:', expected);
}
console.log('\n' + pass + ' pass, ' + fail + ' fail');
process.exit(fail > 0 ? 1 : 0);
