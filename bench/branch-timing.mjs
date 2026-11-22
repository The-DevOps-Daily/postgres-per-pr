// Create a branch of main with a compute, time each stage until a query works, run the same
// migrate, seed and test steps as preview-db.yml, delete the branch, and check it is gone.
// RUNS times, one after another. Writes results/branch-timing-<timestamp>.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { api, project, listBranches, waitForOperations, connectionUri, deleteBranch } from '../scripts/lib/neon.mjs';
import { client } from '../src/db.mjs';
import { ROOT } from '../scripts/lib/env.mjs';

const runs = Number(process.env.RUNS ?? 10);
const main = (await listBranches()).find((b) => b.default);
const stamp = new Date().toISOString().replace(/[:.]/g, '');
const results = [];

function timed(cmd, args, env) {
  const t = performance.now();
  execFileSync(cmd, args, { cwd: ROOT, env: { ...process.env, ...env, TIMINGS_FILE: '' }, stdio: 'pipe' });
  return Math.round(performance.now() - t);
}

for (let i = 1; i <= runs; i++) {
  const name = `bench/run-${stamp}-${i}`;
  const r = { run: i, name };
  const t0 = performance.now();
  const ms = () => Math.round(performance.now() - t0);
  const created = await api('POST', `/projects/${project()}/branches`, {
    branch: { name, parent_id: main.id, expires_at: new Date(Date.now() + 3_600_000).toISOString() },
    endpoints: [{ type: 'read_write' }],
  });
  r.apiReturnedMs = ms();
  r.branchId = created.branch.id;
  try {
    await waitForOperations(created.operations);
    r.operationsFinishedMs = ms();
    const uri = await connectionUri(created.branch.id);
    r.connectionUriMs = ms();
    let attempts = 0;
    for (;;) {
      attempts++;
      try {
        const db = await client(uri);
        await db.query('SELECT 1');
        await db.end();
        break;
      } catch (e) {
        if (ms() > 120_000) throw e;
        await new Promise((res) => setTimeout(res, 250));
      }
    }
    r.firstQueryMs = ms();
    r.connectAttempts = attempts;
    const env = { DATABASE_URL: uri };
    r.migrateMs = timed('node', ['scripts/migrate.mjs'], env);
    r.seedMs = timed('node', ['scripts/seed.mjs'], env);
    r.testMs = timed('node', ['--test', 'test/bookmarks.test.mjs'], env);
    const db = await client(uri);
    const { rows } = await db.query('SELECT (SELECT count(*) FROM bookmarks)::int AS bookmarks, pg_database_size(current_database())::bigint AS db_bytes');
    await db.end();
    r.bookmarksOnBranch = rows[0].bookmarks;
    r.dbBytes = Number(rows[0].db_bytes);
  } finally {
    const d0 = performance.now();
    await deleteBranch(created.branch.id);
    r.deleteMs = Math.round(performance.now() - d0);
    const after = await api('GET', `/projects/${project()}/branches/${created.branch.id}`, undefined, { allow: [404] });
    r.goneAfterDelete = after.status === 404;
  }
  results.push(r);
  console.log(JSON.stringify(r));
}

const out = { bench: 'branch-timing', at: new Date().toISOString(), runner: process.env.RUNNER_NAME ?? 'local', parent: main.name, runs: results };
mkdirSync(`${ROOT}/results`, { recursive: true });
writeFileSync(`${ROOT}/results/branch-timing-${stamp}.json`, JSON.stringify(out, null, 2) + '\n');
