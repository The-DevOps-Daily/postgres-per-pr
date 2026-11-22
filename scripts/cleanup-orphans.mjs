// Delete preview branches that outlived their pull request. The close workflow deletes a branch
// when its PR closes; this catches the runs that failed, were cancelled or never ran.
// A branch is deleted when its name is preview/pr-<n> and either PR <n> is not open or the branch
// is older than MAX_AGE_DAYS. Other branches, the default branch and protected branches are never
// touched. DRY_RUN=1 only prints.
import { appendFileSync } from 'node:fs';
import { need } from './lib/env.mjs';
import { listBranches, deleteBranch } from './lib/neon.mjs';

const maxAgeDays = Number(process.env.MAX_AGE_DAYS ?? 7);
const dryRun = process.env.DRY_RUN === '1';
const repo = need('GITHUB_REPOSITORY');

async function prState(n) {
  const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${n}`, {
    headers: { Authorization: `Bearer ${need('GITHUB_TOKEN')}`, Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) return 'missing';
  if (!res.ok) throw new Error(`GitHub API pulls/${n}: HTTP ${res.status}`);
  return (await res.json()).state;
}

const report = [];
for (const b of await listBranches()) {
  const m = b.name.match(/^preview\/pr-(\d+)$/);
  if (!m || b.default || b.protected) continue;
  const ageDays = (Date.now() - Date.parse(b.created_at)) / 86_400_000;
  const state = await prState(m[1]);
  const reason = state !== 'open' ? `PR #${m[1]} is ${state}` : ageDays > maxAgeDays ? `older than ${maxAgeDays} days` : null;
  const row = { branch: b.name, id: b.id, pr: Number(m[1]), state, ageDays: Number(ageDays.toFixed(3)), action: 'keep' };
  if (reason) {
    row.action = dryRun ? `would delete (${reason})` : `deleted (${reason})`;
    if (!dryRun) await deleteBranch(b.id);
  }
  report.push(row);
  console.log(`${row.branch}: ${row.action}`);
}
if (report.length === 0) console.log('no preview branches');
if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = ['| Branch | PR state | Age (days) | Action |', '| --- | --- | --- | --- |'];
  for (const r of report) lines.push(`| ${r.branch} | ${r.state} | ${r.ageDays} | ${r.action} |`);
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
}
console.log(JSON.stringify({ maxAgeDays, dryRun, report }));
