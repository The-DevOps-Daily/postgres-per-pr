-- listBookmarks filters by user and sorts newest first.
CREATE INDEX bookmarks_user_recent_idx ON bookmarks (user_id, created_at DESC, id DESC);
