/**
 * Upload Knowledge Base to Retell AI and attach to agent
 *
 * Usage:
 *   node scripts/upload_retell_kb.mjs
 *
 * Requires RETELL_API_KEY in .env
 */

import { readFileSync, createReadStream } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --------------- Config ---------------

const RETELL_API = 'https://api.retellai.com';
const KB_FILE = resolve(__dirname, '../callrail-puller/recordings/kb-docs/retell-knowledge-base.md');
const KB_NAME = '32 Family Dental KB'; // max 40 chars
const AGENT_NAME_SEARCH = '32 Family Dental'; // partial match

// Load .env manually (no deps)
function loadEnv() {
  try {
    const envPath = resolve(__dirname, '../.env');
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* .env not found */ }
}

loadEnv();

const API_KEY = process.env.RETELL_API_KEY;
if (!API_KEY) {
  console.error('ERROR: RETELL_API_KEY not set in .env');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${API_KEY}`,
};

// --------------- Helpers ---------------

async function retellGet(path) {
  const res = await fetch(`${RETELL_API}${path}`, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET ${path} failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function retellPatch(path, body) {
  const res = await fetch(`${RETELL_API}${path}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

// --------------- Step 1: Create Knowledge Base ---------------

async function createKnowledgeBase() {
  console.log(`\n--- Step 1: Create Knowledge Base ---`);
  console.log(`Reading: ${KB_FILE}`);

  const fileBuffer = readFileSync(KB_FILE);
  console.log(`File size: ${(fileBuffer.length / 1024).toFixed(1)} KB`);

  // Use multipart form-data with file upload (supports up to 50MB)
  const formData = new FormData();
  formData.append('knowledge_base_name', KB_NAME);
  formData.append(
    'knowledge_base_files',
    new Blob([fileBuffer], { type: 'text/markdown' }),
    basename(KB_FILE)
  );

  const res = await fetch(`${RETELL_API}/create-knowledge-base`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}` }, // no Content-Type — fetch sets it with boundary
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Create KB failed (${res.status}): ${body}`);
  }

  const kb = await res.json();
  console.log(`Knowledge Base created!`);
  console.log(`  ID:     ${kb.knowledge_base_id}`);
  console.log(`  Name:   ${kb.knowledge_base_name}`);
  console.log(`  Status: ${kb.status}`);
  return kb.knowledge_base_id;
}

// --------------- Step 2: Find Agent ---------------

async function findAgent() {
  console.log(`\n--- Step 2: Find Agent "${AGENT_NAME_SEARCH}" ---`);

  const agents = await retellGet('/list-agents');
  const match = agents.find(
    (a) => a.agent_name && a.agent_name.toLowerCase().includes(AGENT_NAME_SEARCH.toLowerCase())
  );

  if (!match) {
    console.log(`Available agents:`);
    agents.forEach((a) => console.log(`  - ${a.agent_name || '(unnamed)'} [${a.agent_id}]`));
    throw new Error(`No agent found matching "${AGENT_NAME_SEARCH}"`);
  }

  console.log(`Found agent: ${match.agent_name} [${match.agent_id}]`);

  // Get full agent details to find engine type
  const agent = await retellGet(`/get-agent/${match.agent_id}`);
  const engine = agent.response_engine;
  console.log(`Engine type: ${engine?.type}`);

  if (engine?.type === 'conversation-flow') {
    return {
      agentId: match.agent_id,
      agentName: match.agent_name,
      engineType: 'conversation-flow',
      engineId: engine.conversation_flow_id,
    };
  } else if (engine?.llm_id) {
    return {
      agentId: match.agent_id,
      agentName: match.agent_name,
      engineType: 'retell-llm',
      engineId: engine.llm_id,
    };
  }

  console.log(`Agent response_engine:`, JSON.stringify(engine, null, 2));
  throw new Error(`Unsupported engine type: ${engine?.type}`);
}

// --------------- Step 3: Attach KB ---------------

async function attachKb(engineType, engineId, kbId) {
  console.log(`\n--- Step 3: Attach KB to ${engineType} ---`);
  console.log(`Engine: ${engineId}`);
  console.log(`KB:     ${kbId}`);

  if (engineType === 'conversation-flow') {
    // Get existing conversation flow to preserve existing KB IDs
    const flow = await retellGet(`/get-conversation-flow/${engineId}`);
    const existingKbIds = flow.knowledge_base_ids || [];

    if (existingKbIds.includes(kbId)) {
      console.log(`KB already attached to conversation flow!`);
      return;
    }

    const updatedKbIds = [...existingKbIds, kbId];

    const updated = await retellPatch(`/update-conversation-flow/${engineId}`, {
      knowledge_base_ids: updatedKbIds,
    });

    console.log(`KB attached to conversation flow!`);
    console.log(`  Knowledge bases: ${updated.knowledge_base_ids?.length || 0}`);
  } else {
    // Retell LLM path
    const llm = await retellGet(`/get-retell-llm/${engineId}`);
    const existingKbIds = llm.knowledge_base_ids || [];

    if (existingKbIds.includes(kbId)) {
      console.log(`KB already attached to LLM!`);
      return;
    }

    const updatedKbIds = [...existingKbIds, kbId];

    const updated = await retellPatch(`/update-retell-llm/${engineId}`, {
      knowledge_base_ids: updatedKbIds,
    });

    console.log(`KB attached to LLM!`);
    console.log(`  Knowledge bases: ${updated.knowledge_base_ids?.length || 0}`);
  }
}

// --------------- Main ---------------

async function main() {
  console.log('=== Retell AI Knowledge Base Upload ===');

  try {
    // Skip KB creation if ID is passed as arg (for re-attaching existing KB)
    let kbId = process.argv[2];

    if (!kbId) {
      kbId = await createKnowledgeBase();
    } else {
      console.log(`\nUsing existing KB: ${kbId}`);
    }

    const { engineType, engineId, agentName } = await findAgent();
    await attachKb(engineType, engineId, kbId);

    console.log(`\n=== Done! ===`);
    console.log(`KB "${KB_NAME}" is now attached to agent "${agentName}"`);
    console.log(`KB ID: ${kbId}`);
    console.log(`\nNext steps:`);
    console.log(`1. Open Retell dashboard to verify`);
    console.log(`2. Test with: "What are your office hours?"`);
    console.log(`3. Test with: "Do you accept Delta Dental?"`);
    console.log(`4. Test with: "I have a toothache"`);
  } catch (err) {
    console.error(`\nERROR: ${err.message}`);
    process.exit(1);
  }
}

main();
