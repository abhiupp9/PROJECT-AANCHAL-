const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Ensure dotenv is loaded
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Check if credentials are correct or placeholder values
if (!supabaseUrl || !supabaseKey || 
    supabaseUrl.includes('placeholder') || 
    supabaseKey.includes('placeholder')) {
  console.warn('\n⚠️  [AANCHAL Backend Warning]: Supabase credentials are not configured or are placeholder values.');
  console.warn('   Please configure SUPABASE_URL and SUPABASE_KEY in your server/.env file.');
  console.warn('   The server will run, but database operations will fail until valid credentials are provided.\n');
}

const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');

module.exports = supabase;
