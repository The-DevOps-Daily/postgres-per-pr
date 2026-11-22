// Poll until the database answers SELECT 1, and report how long that took. The create-branch
// step returns once Neon says the branch exists; this is the time until a query works.
import { appendFileSync } from 'node:fs';
import { client } from '../src/db.mjs';

// create-branch-action does not register its outputs as secrets. Mask the password for the rest
// of the job before anything else can print it.
if (process.env.GITHUB_ACTIONS === 'true' && process.env.DATABASE_URL) {
  const password = decodeURIComponent(new URL(process.env.DATABASE_URL).password);
  if (password) console.log(`::add-mask::${password}`);
}

const started = performance.now();
let attempts = 0;
let lastError;
while (performance.now() - started < 120_000) {
  attempts++;
  try {
    const db = await client();
    await db.query('SELECT 1');
    await db.end();
    const result = { step: 'first-query', ms: Math.round(performance.now() - started), attempts };
    console.log(JSON.stringify(result));
    if (process.env.TIMINGS_FILE) appendFileSync(process.env.TIMINGS_FILE, JSON.stringify(result) + '\n');
    process.exit(0);
  } catch (e) {
    lastError = e.code ?? e.message;
    await new Promise((r) => setTimeout(r, 500));
  }
}
console.error(`database not reachable after ${attempts} attempts: ${lastError}`);
process.exit(1);
