-- Archive instead of delete. A nullable column with no default is a catalog-only change.
ALTER TABLE bookmarks ADD COLUMN archived_at timestamptz;
