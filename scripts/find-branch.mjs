// find-branch.mjs <name>                   sets the step output exists=true|false
// find-branch.mjs <name> --expect-missing  fails if the branch still exists
import { appendFileSync } from 'node:fs';
import { listBranches } from './lib/neon.mjs';

const [name, flag] = process.argv.slice(2);
if (!name) throw new Error('usage: find-branch.mjs <branch-name> [--expect-missing]');
const branch = (await listBranches()).find((b) => b.name === name);
console.log(branch ? `${name} exists (${branch.id})` : `${name} not found`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `exists=${Boolean(branch)}\n`);
if (flag === '--expect-missing' && branch) process.exit(1);
