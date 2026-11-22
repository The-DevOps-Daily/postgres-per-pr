// The app: a small bookmarks service. Each function takes a pg Pool or Client.

export async function createUser(db, email) {
  const { rows } = await db.query(
    `INSERT INTO users (email) VALUES ($1)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id, email`,
    [email],
  );
  return rows[0];
}

export async function addBookmark(db, userId, { url, title, tags = [] }) {
  const { rows } = await db.query(
    `INSERT INTO bookmarks (user_id, url, title, tags) VALUES ($1, $2, $3, $4)
     RETURNING id, url, title, tags, created_at`,
    [userId, url, title, tags],
  );
  return rows[0];
}

export async function listBookmarks(db, userId, { limit = 20, tag } = {}) {
  const { rows } = await db.query(
    `SELECT id, url, title, tags, created_at FROM bookmarks
     WHERE user_id = $1 AND ($2::text IS NULL OR $2 = ANY (tags))
     ORDER BY created_at DESC, id DESC
     LIMIT $3`,
    [userId, tag ?? null, limit],
  );
  return rows;
}

export async function deleteUser(db, userId) {
  await db.query('DELETE FROM users WHERE id = $1', [userId]);
}
