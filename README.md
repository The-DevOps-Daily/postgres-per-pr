# postgres-per-pr

A Postgres database for every pull request: GitHub Actions creates a Neon branch of `main` when a
pull request opens, runs migrations, seed and tests on it, posts the schema diff, and deletes the
branch when the pull request closes. A daily sweep deletes branches that the close job missed.

Results and the write-up: coming soon.
