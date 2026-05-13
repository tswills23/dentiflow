import { selectTemplate, getTemplateId } from '../src/services/recall/templates';

const phones = ['+18472640587','+15555550001','+15555550002','+15555550003','+15555550004','+18472643211'];

console.log('=== Doctor Day 1 (override: always v2) ===');
for (const p of phones) {
  const id = getTemplateId('doctor', 1, p);
  const tpl = selectTemplate('doctor', 1, p);
  console.log(p, '→', id, '|', tpl.body.substring(0,70));
}

console.log('\n=== Doctor Day 0 (should still split v1/v2) ===');
for (const p of phones) console.log(p, '→', getTemplateId('doctor', 0, p));

console.log('\n=== Doctor Day 3 (should still split) ===');
for (const p of phones) console.log(p, '→', getTemplateId('doctor', 3, p));

console.log('\n=== Hygienist Day 1 (other voices unaffected) ===');
for (const p of phones) console.log(p, '→', getTemplateId('hygienist', 1, p));

console.log('\n=== Office Day 1 (other voices unaffected) ===');
for (const p of phones) console.log(p, '→', getTemplateId('office', 1, p));
