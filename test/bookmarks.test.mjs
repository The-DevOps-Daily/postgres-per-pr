import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.mjs';
import { createUser, addBookmark, listBookmarks, deleteUser } from '../src/bookmarks.mjs';

const db = pool();
const email = `test-${process.pid}-${Date.now()}@example.com`;
const user = await createUser(db, email);
after(async () => {
  await deleteUser(db, user.id);
  await db.end();
});

test('the seed fixture user exists with 50 bookmarks', async () => {
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM bookmarks b JOIN users u ON u.id = b.user_id
     WHERE u.email = 'preview-fixture@example.com'`,
  );
  assert.equal(rows[0].n, 50);
});

test('bookmarks list newest first and filter by tag', async () => {
  await addBookmark(db, user.id, { url: 'https://example.com/a', title: 'A', tags: ['postgres'] });
  await addBookmark(db, user.id, { url: 'https://example.com/b', title: 'B', tags: ['ci'] });
  const all = await listBookmarks(db, user.id);
  assert.deepEqual(all.map((b) => b.title), ['B', 'A']);
  const tagged = await listBookmarks(db, user.id, { tag: 'postgres' });
  assert.deepEqual(tagged.map((b) => b.title), ['A']);
});

test('the same URL twice for one user is refused', async () => {
  await assert.rejects(
    addBookmark(db, user.id, { url: 'https://example.com/a', title: 'again' }),
    (e) => e.code === '23505',
  );
});
