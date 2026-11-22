// Collect the real GitHub Actions runs of this repository: every preview-db, preview-db-cleanup,
// ci-container, orphan-sweep and deploy-migrations run, with job and step durations, plus the
// millisecond timings each preview-db and ci-container run uploaded. Writes results/actions-runs.json.
// Needs GITHUB_TOKEN (read access) and GITHUB_REPOSITORY.
import { writeFileSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { need, ROOT } from '../scripts/lib/env.mjs';

const repo = need('GITHUB_REPOSITORY');
async function gh(path) {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    headers: { Authorization: `Bearer ${need('GITHUB_TOKEN')}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub API ${path}: HTTP ${res.status}`);
  return res;
}
const secs = (a, b) => (Date.parse(b) - Date.parse(a)) / 1000;
const wanted = ['preview-db', 'preview-db-cleanup', 'ci-container', 'orphan-sweep', 'deploy-migrations'];

const { workflow_runs } = await (await gh('/actions/runs?per_page=100')).json();
const runs = [];
for (const run of workflow_runs.filter((r) => wanted.includes(r.name)).reverse()) {
  const { jobs } = await (await gh(`/actions/runs/${run.id}/jobs`)).json();
  const { artifacts } = await (await gh(`/actions/runs/${run.id}/artifacts`)).json();
  let timings = null;
  const art = artifacts.find((a) => a.name.includes('timings'));
  if (art && !art.expired) {
    const zip = Buffer.from(await (await gh(`/actions/artifacts/${art.id}/zip`)).arrayBuffer());
    const dir = mkdtempSync(`${tmpdir()}/timings-`);
    writeFileSync(`${dir}/a.zip`, zip);
    execFileSync('unzip', ['-q', '-o', `${dir}/a.zip`, '-d', dir]);
    const file = readdirSync(dir).find((f) => f.endsWith('.jsonl'));
    if (file) timings = readFileSync(`${dir}/${file}`, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  }
  runs.push({
    id: run.id,
    workflow: run.name,
    event: run.event,
    action: run.display_title,
    branch: run.head_branch,
    pr: run.pull_requests?.[0]?.number ?? null,
    conclusion: run.conclusion,
    createdAt: run.created_at,
    runSeconds: secs(run.run_started_at, run.updated_at),
    jobs: jobs.map((j) => ({
      name: j.name,
      conclusion: j.conclusion,
      queuedSeconds: secs(j.created_at, j.started_at),
      seconds: j.completed_at ? secs(j.started_at, j.completed_at) : null,
      steps: (j.steps ?? []).map((s) => ({
        name: s.name,
        conclusion: s.conclusion,
        seconds: s.completed_at && s.started_at ? secs(s.started_at, s.completed_at) : null,
      })),
    })),
    timings,
  });
  console.log(`${run.name} ${run.head_branch} ${run.event} ${run.conclusion} ${runs.at(-1).jobs[0]?.seconds ?? '-'} s`);
}
writeFileSync(`${ROOT}/results/actions-runs.json`, JSON.stringify({ repo, collectedAt: new Date().toISOString(), runs }, null, 2) + '\n');
