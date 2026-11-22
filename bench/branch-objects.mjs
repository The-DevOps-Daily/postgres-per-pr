// What each preview branch changed, measured inside Postgres: database size, the size of the
// relations that differ from main, and the rows that differ. Copy-on-write storage only keeps
// the pages a branch writes, so these are the bytes the branch can add on top of main.
import { mkdirSync, writeFileSync } from 'node:fs';
import { listBranches, connectionUri } from '../scripts/lib/neon.mjs';
import { client } from '../src/db.mjs';
import { ROOT } from '../scripts/lib/env.mjs';

const sizes = `SELECT c.relname, c.relkind, pg_relation_size(c.oid)::bigint AS bytes
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'i') ORDER BY 1`;
const out = { at: new Date().toISOString(), branches: [] };
const branches = await listBranches();
const main = branches.find((b) => b.default);
const base = new Map();
for (const b of [main, ...branches.filter((x) => x.name.startsWith('preview/'))]) {
  const db = await client(await connectionUri(b.id));
  const { rows } = await db.query(sizes);
  const meta = await db.query(`SELECT pg_database_size(current_database())::bigint AS db_bytes,
    (SELECT count(*) FROM bookmarks)::int AS bookmarks,
    (SELECT array_agg(name ORDER BY name) FROM schema_migrations) AS migrations`);
  await db.end();
  if (b.default) rows.forEach((r) => base.set(r.relname, Number(r.bytes)));
  const changed = rows
    .filter((r) => base.get(r.relname) !== Number(r.bytes))
    .map((r) => ({ relation: r.relname, kind: r.relkind, bytes: Number(r.bytes), mainBytes: base.get(r.relname) ?? 0 }));
  out.branches.push({ name: b.name, id: b.id, dbBytes: Number(meta.rows[0].db_bytes), bookmarks: meta.rows[0].bookmarks, migrations: meta.rows[0].migrations, changed });
  console.log(JSON.stringify(out.branches.at(-1)));
}
mkdirSync(`${ROOT}/results`, { recursive: true });
writeFileSync(`${ROOT}/results/branch-objects-${out.at.replace(/[:.]/g, '')}.json`, JSON.stringify(out, null, 2) + '\n');
