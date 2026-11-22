-- https://Example.com/a and https://example.com/a are the same bookmark: refuse the second.
-- Production already has such pairs, so keep the oldest bookmark of each pair first.
DELETE FROM bookmarks b
USING bookmarks keep
WHERE keep.user_id = b.user_id
  AND lower(keep.url) = lower(b.url)
  AND (keep.created_at, keep.id) < (b.created_at, b.id);

CREATE UNIQUE INDEX bookmarks_user_url_lower_key ON bookmarks (user_id, lower(url));
