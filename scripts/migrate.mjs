// Apply migrations/*.sql in file-name order, each in its own transaction, and record them in
// schema_migrations. A branch of main already has main's rows in that table, so only the
// migrations a pull request adds run on its preview branch.
import { readFileSync, readdirSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { client } from '../src/db.mjs';
import { ROOT } from './lib/env.mjs';

const started = performance.now();
const db = await client();
const applied = [];
try {
  await db.query('SELECT pg_advisory_lock(424242)');
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    sha256 text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const { rows } = await db.query('SELECT name, sha256 FROM schema_migrations');
  const done = new Map(rows.map((r) => [r.name, r.sha256]));
  const files = readdirSync(`${ROOT}/migrations`).filter((f) => f.endsWith('.sql')).sort();
  for (const name of files) {
    const sql = readFileSync(`${ROOT}/migrations/${name}`, 'utf8');
    const sha256 = createHash('sha256').update(sql).digest('hex');
    if (done.has(name)) {
      if (done.get(name) !== sha256) throw new Error(`${name} changed after it was applied`);
      continue;
    }
    const t = performance.now();
    await db.query('BEGIN');
    try {
      await db.query(sql);
      await db.query('INSERT INTO schema_migrations (name, sha256) VALUES ($1, $2)', [name, sha256]);
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      throw new Error(`${name} failed: ${e.code ?? ''} ${e.message}`);
    }
    applied.push({ name, ms: Math.round(performance.now() - t) });
    console.log(`applied ${name} in ${applied.at(-1).ms} ms`);
  }
} finally {
  await db.end();
}
const result = { step: 'migrate', applied, ms: Math.round(performance.now() - started) };
if (applied.length === 0) console.log('no new migrations');
console.log(JSON.stringify(result));
if (process.env.TIMINGS_FILE) appendFileSync(process.env.TIMINGS_FILE, JSON.stringify(result) + '\n');
