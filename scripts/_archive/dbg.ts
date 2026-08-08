import { readFileSync } from 'fs';
const text = readFileSync("c:/Users/tswil/Dentiflow speed to lead/Interactive+Schedule+Report+Builder.csv", 'utf8');
const lines = text.split(/\r?\n/).filter(l => l.trim());
let hdrIdx = 0;
for (let i = 0; i < 20; i++) {
  if (lines[i].toLowerCase().includes('phone') || lines[i].toLowerCase().includes('first name')) {
    hdrIdx = i; break;
  }
}
console.log('hdrIdx:', hdrIdx);
console.log('hdr line:', JSON.stringify(lines[hdrIdx]));
const headers = lines[hdrIdx].split(',').map(h => h.trim().replace(/^"|"$/g,'').toLowerCase());
console.log('parsed headers:', headers);
console.log('phIdx:', headers.indexOf('phone'));
console.log('first sample row:', JSON.stringify(lines[hdrIdx+1]));
