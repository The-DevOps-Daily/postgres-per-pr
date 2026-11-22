// Test fixtures for a preview database: one known user with a few bookmarks. Idempotent, so a
// second push to the same pull request does not duplicate anything.
import { appendFileSync } from 'node:fs';
import { client } from '../src/db.mjs';

const started = performance.now();
const db = await client();
try {
  await db.query('BEGIN');
  const { rows } = await db.query(
    `INSERT INTO users (email) VALUES ('preview-fixture@example.com')
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id`,
  );
  const userId = rows[0].id;
  await db.query(
    `INSERT INTO bookmarks (user_id, url, title, tags)
     SELECT $1, 'https://example.com/fixture/' || g, 'Fixture ' || g,
            CASE WHEN g % 2 = 0 THEN ARRAY['even'] ELSE ARRAY['odd'] END
     FROM generate_series(1, 50) AS g
     ON CONFLICT (user_id, url) DO NOTHING`,
    [userId],
  );
  await db.query('COMMIT');
} finally {
  await db.end();
}
const result = { step: 'seed', ms: Math.round(performance.now() - started) };
console.log(JSON.stringify(result));
if (process.env.TIMINGS_FILE) appendFileSync(process.env.TIMINGS_FILE, JSON.stringify(result) + '\n');
