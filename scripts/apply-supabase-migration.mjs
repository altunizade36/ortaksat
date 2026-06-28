import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import pg from "pg";

const { Client } = pg;

const defaultMigration = "supabase/migrations/20260609203000_partnership_sales_flow_enhancements.sql";

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      const value = rawValue.replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env is optional; CI can provide variables directly.
  }
}

function connectionString() {
  return (
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DIRECT_URL ||
    ""
  );
}

function redact(value) {
  return value.replace(/postgres(?:ql)?:\/\/([^:]+):([^@]+)@/i, "postgresql://$1:***@");
}

async function main() {
  loadDotEnv();

  const migrationPath = resolve(process.cwd(), process.argv[2] || defaultMigration);
  const url = connectionString();

  if (!url) {
    console.error("Missing database URL. Add SUPABASE_DB_URL or DATABASE_URL to .env.");
    console.error("Example: SUPABASE_DB_URL=postgresql://postgres:YOUR_PASSWORD@db.akyzzdwbzgsnhdircuce.supabase.co:5432/postgres");
    process.exit(1);
  }

  const sql = readFileSync(migrationPath, "utf8");
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });

  console.log(`Applying migration: ${migrationPath}`);
  console.log(`Database: ${redact(url)}`);

  await client.connect();
  try {
    await client.query(sql);
    const verification = await client.query(`
      select
        exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'listings' and column_name = 'share_templates'
        ) as listings_ready,
        exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'partnerships' and column_name = 'share_channel'
        ) as partnerships_ready,
        exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'commissions' and column_name = 'seller_marked_paid_at'
        ) as commissions_ready
    `);
    console.log("Migration applied.");
    console.log(JSON.stringify(verification.rows[0], null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Migration failed.");
  console.error(error?.message ?? error);
  process.exit(1);
});
