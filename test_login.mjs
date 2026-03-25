import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="(.*?)"/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*?)"/);

if (!urlMatch || !keyMatch) {
  console.error("Missing keys in .env");
  process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function test() {
  const res = await supabase.auth.signInWithPassword({
    email: 'admin@demo.com',
    password: 'password123'
  });
  console.log(JSON.stringify(res, null, 2));
}

test();
