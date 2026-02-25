import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const migrationsDir = path.join(repoRoot, 'src/server/db/migrations');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(connectionString, options = {}) {
  const {
    attempts = 30,
    initialDelayMs = 250,
    maxDelayMs = 2000,
  } = options;

  let delayMs = initialDelayMs;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const attemptClient = new Client({ connectionString });
    try {
      await attemptClient.connect();
      return attemptClient;
    } catch (err) {
      lastError = err;
      await attemptClient.end().catch(() => {});
      const remaining = attempts - attempt;
      console.error(
        `Database not ready (attempt ${attempt}/${attempts}).` +
          (remaining > 0 ? ` Retrying in ${delayMs}ms...` : ''),
      );
      if (remaining <= 0) break;
      await sleep(delayMs);
      delayMs = Math.min(maxDelayMs, Math.round(delayMs * 1.5));
    }
  }

  throw lastError;
}

async function main() {
  const client = await connectWithRetry(databaseUrl);
  try {
    const lockKey = 824061317;
    await client.query('select pg_advisory_lock($1)', [lockKey]);
    try {
    await client.query(`
      create table if not exists schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    const files = (await fs.readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const version = file;
      const { rows } = await client.query(
        'select version from schema_migrations where version = $1',
        [version],
      );
      if (rows.length > 0) continue;

      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query(
          'insert into schema_migrations(version) values ($1)',
          [version],
        );
        await client.query('commit');
        console.log(`Applied migration ${version}`);
      } catch (err) {
        await client.query('rollback');
        throw err;
      }
    }
    } finally {
      await client.query('select pg_advisory_unlock($1)', [lockKey]).catch(() => {});
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
