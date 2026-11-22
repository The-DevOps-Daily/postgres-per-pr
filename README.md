# postgres-per-pr

A Postgres database for every pull request, on Neon branches, with GitHub Actions. When a pull
request opens, a workflow creates a Neon branch of `main` named `preview/pr-<number>`, runs the
migrations, seed and tests on it, and comments the schema diff and the host (never the password).
When the pull request closes, merged or not, another workflow deletes the branch. A daily sweep
deletes branches that the close job missed, and every branch also expires after 14 days.

Write-up with the measurements: https://devops-daily.com/posts/postgres-database-per-pull-request-preview

## Use it in your repository

1. Copy [`examples/preview-db.yml`](examples/preview-db.yml) and
   [`examples/preview-db-cleanup.yml`](examples/preview-db-cleanup.yml) to `.github/workflows/`,
   and [`.github/workflows/orphan-sweep.yml`](.github/workflows/orphan-sweep.yml) with
   [`scripts/cleanup-orphans.mjs`](scripts/cleanup-orphans.mjs) and `scripts/lib/`.
2. Replace the "Migrate, seed, test" step with your own commands. They get `DATABASE_URL`.
3. Add a `NEON_API_KEY` secret and a `NEON_PROJECT_ID` variable. The Neon GitHub integration
   sets both; if you make the key yourself, make it project-scoped.

The workflows skip pull requests from forks, which get no secrets.

## Run the demo yourself

```bash
npm ci
cp .env.example .env          # DATABASE_URL of an empty Neon main branch, plus the API key and project ID
npm run migrate               # 001 and 002
node scripts/seed-production.mjs   # 50,000 synthetic users, 1,002,000 bookmarks
```

Then push the repo, set the secret and variable, and open a pull request that adds a migration.

## What is in here

| Path | What it does |
| --- | --- |
| `migrations/` | Plain SQL migrations, applied in file-name order |
| `scripts/migrate.mjs` | Applies new migrations and records them in `schema_migrations` |
| `scripts/seed.mjs` | Idempotent test fixtures for a preview database |
| `scripts/seed-production.mjs` | Fills `main` with production-shaped synthetic data, once |
| `scripts/wait-for-db.mjs` | Retries `SELECT 1` and reports the time until it works |
| `scripts/cleanup-orphans.mjs` | The daily sweep: deletes `preview/pr-<n>` branches whose PR is not open, or that are too old |
| `scripts/find-branch.mjs` | Used by the close workflow to skip a branch that is already gone |
| `.github/workflows/preview-db.yml` | The per-PR workflow, with timing steps for the measurements |
| `.github/workflows/preview-db-cleanup.yml` | Deletes the branch on close |
| `.github/workflows/orphan-sweep.yml` | Runs the sweep daily or on demand (with dry run) |
| `.github/workflows/ci-container.yml` | The comparison: same steps on an empty `postgres:18` service container |
| `.github/workflows/deploy-migrations.yml` | After a merge, applies the new migrations to `main` |
| `.github/workflows/bench.yml` | Runs the benchmarks below on GitHub's runners |
| `examples/` | The copy-paste versions of the two per-PR workflows, without the timing steps |

## Measurements

All raw data is in [`results/`](results/).

| File | What it measured |
| --- | --- |
| `branch-timing-*.json` | `bench/branch-timing.mjs`: 10 branches of `main` in a row, time to a working query, migrate, seed, test, delete, and a 404 after delete |
| `limits-*.json` | `bench/limits.mjs`: the project filled to 25 branches with a compute each, then every compute queried at once |
| `branch-objects-*.json` | `bench/branch-objects.mjs`: what each preview branch changed, measured inside Postgres |
| `actions-runs.json` | `bench/actions-timings.mjs`: every real workflow run of this repo, with job and step durations and the timings each run uploaded |

RESULTS_SUMMARY

## License

MIT
