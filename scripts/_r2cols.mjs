import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb.from('automation_log').select('*').limit(1);
if (error) { console.error(error); process.exit(1); }
console.log('columns:', Object.keys(data[0]||{}));
console.log(JSON.stringify(data[0],null,2));
