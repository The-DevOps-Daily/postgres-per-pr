// Fill the project up to TARGET_BRANCHES branches (main and any preview branches included), each
// new branch with its own compute, then query every compute at once and record which ones answer.
// Shows two limits: branches included in the plan, and concurrently active computes.
// Deletes every branch it made and checks the count is back where it started.
import { mkdirSync, writeFileSync } from 'node:fs';
import { api, project, listBranches, waitForOperations, connectionUri, deleteBranch } from '../scripts/lib/neon.mjs';
import { client } from '../src/db.mjs';
import { ROOT } from '../scripts/lib/env.mjs';

const target = Number(process.env.TARGET_BRANCHES ?? 25);
const stamp = new Date().toISOString().replace(/[:.]/g, '');
const before = await listBranches();
const main = before.find((b) => b.default);
const made = [];
const out = { bench: 'limits', at: new Date().toISOString(), target, branchesBefore: before.length, creates: [], queries: [] };

try {
  for (let n = before.length + 1; n <= target; n++) {
    const name = `bench/limit-${stamp}-${n}`;
    const t = performance.now();
    try {
      const res = await api('POST', `/projects/${project()}/branches`, {
        branch: { name, parent_id: main.id, expires_at: new Date(Date.now() + 3_600_000).toISOString() },
        endpoints: [{ type: 'read_write' }],
      });
      made.push(res.branch.id);
      await waitForOperations(res.operations);
      out.creates.push({ n, name, id: res.branch.id, ok: true, ms: Math.round(performance.now() - t), endpointState: res.endpoints?.[0]?.current_state });
    } catch (e) {
      out.creates.push({ n, name, ok: false, ms: Math.round(performance.now() - t), status: e.status, error: e.body ?? e.message });
    }
    console.log(JSON.stringify(out.creates.at(-1)));
  }

  // Every new compute at once: a connection and SELECT 1, 60 seconds of retries each.
  out.queries = await Promise.all(
    made.map(async (id) => {
      const uri = await connectionUri(id);
      const t = performance.now();
      let lastError;
      let attempts = 0;
      while (performance.now() - t < 60_000) {
        attempts++;
        try {
          const db = await client(uri);
          await db.query('SELECT 1');
          await db.end();
          return { id, ok: true, attempts, ms: Math.round(performance.now() - t) };
        } catch (e) {
          lastError = `${e.code ?? ''} ${e.message}`.trim();
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      return { id, ok: false, attempts, error: lastError };
    }),
  );
  const { endpoints } = await api('GET', `/projects/${project()}/endpoints`);
  out.endpointStates = endpoints.map((e) => ({ branch: e.branch_id, state: e.current_state }));
  out.branchesAtPeak = (await listBranches()).length;
  out.answered = out.queries.filter((q) => q.ok).length;
  out.refused = out.queries.filter((q) => !q.ok).map((q) => q.error);
  console.log(`branches at peak ${out.branchesAtPeak}, computes answered ${out.answered} of ${made.length}`);
} finally {
  for (const id of made) await deleteBranch(id);
  out.branchesAfter = (await listBranches()).length;
  out.cleanedUp = out.branchesAfter === out.branchesBefore;
  console.log(`branches after cleanup ${out.branchesAfter} (before ${out.branchesBefore})`);
  mkdirSync(`${ROOT}/results`, { recursive: true });
  writeFileSync(`${ROOT}/results/limits-${stamp}.json`, JSON.stringify(out, null, 2) + '\n');
}
