// Put the default branch's connection string in DATABASE_URL for the next steps, masked in logs.
import { appendFileSync } from 'node:fs';
import { listBranches, connectionUri } from './lib/neon.mjs';

const main = (await listBranches()).find((b) => b.default);
const uri = await connectionUri(main.id);
console.log(`::add-mask::${uri}`);
console.log(`::add-mask::${new URL(uri).password}`);
appendFileSync(process.env.GITHUB_ENV, `DATABASE_URL=${uri}\n`);
console.log(`DATABASE_URL set for ${main.name} (${main.id})`);
