import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.mjs';
import { createUser, addBookmark, archiveBookmark, deleteUser } from '../src/bookmarks.mjs';

const db = pool();
const user = await createUser(db, `archive-${process.pid}-${Date.now()}@example.com`);
after(async () => {
  await deleteUser(db, user.id);
  await db.end();
});

test('a bookmark can be archived once', async () => {
  const b = await addBookmark(db, user.id, { url: 'https://example.com/old', title: 'Old' });
  assert.equal(await archiveBookmark(db, user.id, b.id), true);
  assert.equal(await archiveBookmark(db, user.id, b.id), false);
});
