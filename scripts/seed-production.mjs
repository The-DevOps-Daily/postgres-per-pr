// Fill the main branch with production-shaped data, once. Synthetic users (no real PII):
// 50,000 users, 1,000,000 bookmarks, and 2,000 bookmarks that differ from another bookmark of
// the same user only in the case of the host name, the kind of duplicate real data collects.
import { client } from '../src/db.mjs';

const db = await client();
// One transaction, so a failed seed leaves nothing behind.
const step = async (label, sql) => {
  const t = performance.now();
  const r = await db.query(sql);
  console.log(`${label}: ${r.rowCount ?? ''} rows in ${Math.round(performance.now() - t)} ms`);
};
try {
  // The 50 preview fixture rows are fine; an earlier production seed is not.
  const { rows } = await db.query('SELECT count(*)::int AS n FROM bookmarks');
  if (rows[0].n > 1000) throw new Error('bookmarks is not empty; seed-production runs once');
  await db.query('BEGIN');
  await step('users', `INSERT INTO users (email, created_at)
    SELECT 'user' || g || '@example.com', now() - g * interval '1 hour'
    FROM generate_series(1, 50000) AS g`);
  await step('bookmarks', `INSERT INTO bookmarks (user_id, url, title, tags, created_at)
    SELECT u.id,
           'https://site' || (g % 9973) || '.example/page/' || g,
           'Bookmark ' || g || ' ' || md5(g::text),
           CASE g % 5 WHEN 0 THEN ARRAY['postgres'] WHEN 1 THEN ARRAY['ci', 'github'] WHEN 2 THEN ARRAY['k8s']
                      WHEN 3 THEN ARRAY['linux', 'bash'] ELSE ARRAY[]::text[] END,
           now() - g * interval '1 minute'
    FROM generate_series(1, 1000000) AS g
    JOIN users u ON u.email = 'user' || (g % 50000) + 1 || '@example.com'`);
  await step('case duplicates', `INSERT INTO bookmarks (user_id, url, title, tags, created_at)
    SELECT user_id, replace(url, 'https://site', 'https://Site'), title || ' (dup)', tags, created_at + interval '1 day'
    FROM bookmarks WHERE id % 500 = 0`);
  await db.query('COMMIT');
  await step('vacuum', 'VACUUM ANALYZE');
  const size = await db.query(`SELECT pg_size_pretty(pg_database_size(current_database())) AS size,
    (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM bookmarks) AS bookmarks`);
  console.log(JSON.stringify(size.rows[0]));
} finally {
  await db.end();
}
