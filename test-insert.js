import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  const fakeId = crypto.randomUUID();
  console.log('Inserting fake user:', fakeId);
  
  const { data, error } = await supabase.from('users').insert({
    id: fakeId,
    email: 'test_guest_' + fakeId + '@example.com',
    name: 'Guest User'
  }).select();
  
  console.log('Result:', { data, error });
}

testInsert();
