-- https://Example.com/a and https://example.com/a are the same bookmark: refuse the second.
CREATE UNIQUE INDEX bookmarks_user_url_lower_key ON bookmarks (user_id, lower(url));
