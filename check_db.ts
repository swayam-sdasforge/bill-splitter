import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Checking buckets...');
  const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets();
  if (bucketsErr) console.error('Buckets error:', bucketsErr);
  else console.log('Buckets:', buckets.map(b => b.name));

  console.log('Checking users table...');
  const { data: users, error: usersErr } = await supabase.from('users').select('*').limit(1);
  if (usersErr) console.error('Users error:', usersErr);
  else console.log('Users schema (first row keys):', users.length > 0 ? Object.keys(users[0]) : 'Empty table');
}

check();
