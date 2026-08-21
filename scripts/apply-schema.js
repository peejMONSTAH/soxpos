const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function applySchema() {
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL is not set in .env.local');
    console.log('\n👉 To enable automatic schema execution:');
    console.log('1. Go to Supabase Dashboard -> Project Settings -> Database -> Connection String (URI)');
    console.log('2. Add to your .env.local:');
    console.log('   DATABASE_URL=postgresql://postgres.iuyoaakuqdmpfvkiydhv:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres\n');
    process.exit(1);
  }

  const schemaPath = path.join(__dirname, '../supabase/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔄 Connecting to Supabase PostgreSQL database...');
    await client.connect();
    console.log('🚀 Applying schema.sql...');
    await client.query(sql);
    console.log('✅ Schema successfully applied to Supabase!');
  } catch (err) {
    console.error('❌ Error applying schema:', err.message);
  } finally {
    await client.end();
  }
}

applySchema();
