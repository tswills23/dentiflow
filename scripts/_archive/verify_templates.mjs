import { readFileSync } from 'fs';

const src = readFileSync('src/services/recall/templates.ts', 'utf8');
const bodies = [];
const re = /body:\s*`([^`]+)`/g;
let m;
while ((m = re.exec(src)) !== null) {
  bodies.push(m[1]);
}

console.log('Total templates:', bodies.length);

const over320 = bodies.filter(b => b.length > 320);
console.log('Over 320 chars:', over320.length);
if (over320.length) {
  over320.forEach(b => console.log('  -', b.length, 'chars:', b.substring(0, 60) + '...'));
}

const maxLen = Math.max(...bodies.map(b => b.length));
const minLen = Math.min(...bodies.map(b => b.length));
console.log('Char range:', minLen, '-', maxLen);

const banned = [
  'cleaning', 'hygiene visit', 'exam', 'overdue', 'missed',
  "it's been", 'since your last', "I haven't seen you",
  'valued patient', 'reminder', 'prophylaxis', 'x-rays'
];

const violations = [];
banned.forEach(w => {
  bodies.forEach((b, i) => {
    if (b.toLowerCase().includes(w.toLowerCase())) {
      violations.push(`Template ${i + 1} has: "${w}"`);
    }
  });
});

console.log('Banned word violations:', violations.length);
violations.forEach(v => console.log('  -', v));

// Check Day 0 templates (first 5 of each voice = indices 0-4, 15-19, 30-34)
const day0Indices = [0,1,2,3,4, 15,16,17,18,19, 30,31,32,33,34];
const scheduleWords = ['schedule', 'stop by', 'come in', 'come by', 'openings', 'work better', 'work best', 'this week', 'mornings', 'afternoons'];
console.log('\nDay 0 CTA check (should have soft CTAs):');
day0Indices.forEach(i => {
  const hasCTA = scheduleWords.some(w => bodies[i].toLowerCase().includes(w));
  if (!hasCTA) console.log(`  Template ${i+1}: NO CTA found`);
});

// Check Day 3 templates (indices 10-14, 25-29, 40-44) have binary CTA
const day3Indices = [10,11,12,13,14, 25,26,27,28,29, 40,41,42,43,44];
console.log('\nDay 3 binary CTA check:');
day3Indices.forEach(i => {
  const has = bodies[i].includes('?') || bodies[i].includes('reply');
  if (!has) console.log(`  Template ${i+1}: NO question/CTA`);
});

console.log('\nAll checks complete.');
