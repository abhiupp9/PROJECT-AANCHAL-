// setup-supabase.js
// Run this ONCE to create all tables in Supabase and seed the admin user
// Usage: node setup-supabase.js

const dotenv = require('dotenv');
dotenv.config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
  console.error('❌ SUPABASE_URL is not set in .env file!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  console.log('\n🔧 AANCHAL — Supabase Database Setup');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🌐 Connecting to: ${supabaseUrl}\n`);

  try {
    // ── Create users table ─────────────────────────────────────────────
    console.log('📋 Creating table: users...');
    const { error: usersErr } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          username TEXT UNIQUE NOT NULL,
          phone TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
        );
        ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
      `
    });

    if (usersErr) {
      // If rpc not available, try direct insert to test connection
      console.warn('⚠️  RPC not available — testing with direct query...');
      const { error: testErr } = await supabase.from('users').select('id').limit(1);
      if (testErr && testErr.code === '42P01') {
        console.error('\n❌ Tables do not exist in Supabase!');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('👉 Please run schema.sql MANUALLY in Supabase:');
        console.error('   1. Go to https://supabase.com/dashboard');
        console.error('   2. Open your project: rqcakcjyaoqbsufwrlpk');
        console.error('   3. Click "SQL Editor" in the sidebar');
        console.error('   4. Paste the contents of server/schema.sql');
        console.error('   5. Click "Run"');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        process.exit(1);
      }
    }

    // ── Seed admin user ────────────────────────────────────────────────
    console.log('👤 Seeding admin user (admin / 1234)...');
    const { error: adminErr } = await supabase
      .from('users')
      .upsert(
        { username: 'admin', phone: '9876543210', password: '1234' },
        { onConflict: 'username', ignoreDuplicates: true }
      );

    if (adminErr) {
      console.warn('⚠️  Could not seed admin user:', adminErr.message);
    } else {
      console.log('✅ Admin user ready — username: admin | password: 1234');
    }

    // ── Seed emergency contacts (only if table is empty) ──────────────────
    console.log('📞 Checking emergency contacts...');
    const { data: existingContacts, error: checkErr } = await supabase
      .from('emergency_contacts')
      .select('id')
      .limit(1);

    if (!checkErr && (!existingContacts || existingContacts.length === 0)) {
      const { error: contactsErr } = await supabase
        .from('emergency_contacts')
        .insert([
          { name: 'Emergency Services (National)', phone: '112', relationship: 'Official' },
          { name: 'Emergency Contact 1 (Father)', phone: '+919876543210', relationship: 'Family' },
          { name: 'Emergency Contact 2 (Sister)', phone: '+918765432109', relationship: 'Family' }
        ]);

      if (contactsErr) {
        console.warn('⚠️  Could not seed contacts:', contactsErr.message);
      } else {
        console.log('✅ Default emergency contacts ready');
      }
    } else {
      console.log('✅ Emergency contacts already exist — skipped seeding');
    }

    console.log('\n✅ Database setup complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 You can now run: npm run dev');
    console.log('🔑 Login with: username=admin | password=1234\n');

  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    console.error('\n👉 Make sure you have run schema.sql in Supabase SQL Editor first!\n');
    process.exit(1);
  }
}

setupDatabase();
