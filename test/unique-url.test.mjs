import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.mjs';
import { createUser, addBookmark, deleteUser } from '../src/bookmarks.mjs';

const db = pool();
const user = await createUser(db, `unique-${process.pid}-${Date.now()}@example.com`);
after(async () => {
  await deleteUser(db, user.id);
  await db.end();
});

test('the same URL with a different case is refused', async () => {
  await addBookmark(db, user.id, { url: 'https://example.com/Case', title: 'one' });
  await assert.rejects(
    addBookmark(db, user.id, { url: 'https://EXAMPLE.com/case', title: 'two' }),
    (e) => e.code === '23505',
  );
});
