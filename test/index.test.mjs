import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.mjs';

const db = pool();
after(() => db.end());

test('the user listing query uses the new index', async () => {
  const { rows } = await db.query(
    `EXPLAIN (FORMAT JSON) SELECT id FROM bookmarks WHERE user_id = 42
     ORDER BY created_at DESC, id DESC LIMIT 20`,
  );
  assert.match(JSON.stringify(rows[0]), /bookmarks_user_recent_idx/);
});
