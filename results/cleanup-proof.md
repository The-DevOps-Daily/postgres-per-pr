# Cleanup proof, 2026-11-22 (UTC)

Every branch the workflows and benches created, and what deleted it. Workflow runs are in
`actions-runs.json`; the bench files record `goneAfterDelete` (HTTP 404 after delete) per branch.

| Branch | Created by | Deleted by | Checked |
| --- | --- | --- | --- |
| 10 x `bench/run-*` | `bench/branch-timing.mjs` | the same script | GET returned 404 for all 10 |
| 24 x `bench/limit-*` | `bench/limits.mjs` | the same script | project back to 1 branch (`cleanedUp: true`) |
| `preview/pr-1` | preview-db, PR #1 opened | preview-db-cleanup, PR #1 merged | `Check it is gone` step: not found |
| `preview/pr-2` | preview-db, PR #2 opened | preview-db-cleanup, PR #2 closed | not found |
| `preview/pr-3` | preview-db, PR #3 opened, reused on push 2 | preview-db-cleanup, PR #3 closed | not found |
| `preview/pr-2` (again) | preview-db, PR #2 reopened | deleted by hand to simulate an expiry; the close run then found nothing and skipped the delete step (success) | not found |
| `preview/pr-4` | example preview-db, PR #4 opened | example cleanup, PR #4 closed | success |
| `preview/pr-4` (again) | example preview-db, PR #4 reopened | deleted by hand; the example cleanup (no lookup step) then failed: `ERROR: Branch preview/pr-4 not found.` | failure, as expected |
| `preview/pr-4` (2 more times) | updated example preview-db, PR #4 reopened to check the example changes | example cleanup, PR #4 closed | success |
| `page-test-1`, `page-test-2` | Neon API, to test branch list pagination | deleted by hand | not in the final list |
| `preview/pr-3` (planted orphan, PR closed) | Neon API | orphan-sweep: `deleted (PR #3 is closed)` | not in the final list |
| `preview/pr-99` (planted orphan, no PR) | Neon API | orphan-sweep: `deleted (PR #99 is missing)` | not in the final list |
| `dev/alice` (planted, not a preview name) | Neon API | kept by orphan-sweep; deleted by hand afterwards | not in the final list |

Orphan sweep runs (workflow_dispatch):

```text
max_age_days=7 dry_run=true   preview/pr-99: would delete (PR #99 is missing)
                              preview/pr-3: would delete (PR #3 is closed)
                              preview/pr-4: keep
max_age_days=0 dry_run=true   preview/pr-99: would delete (PR #99 is missing)
                              preview/pr-3: would delete (PR #3 is closed)
                              preview/pr-4: would delete (older than 0 days)
max_age_days=7 dry_run=false  preview/pr-3: deleted (PR #3 is closed)
                              preview/pr-99: deleted (PR #99 is missing)
                              preview/pr-4: keep
```

Final branch list after everything: `main (br-lively-union-beyn6m9x)`.
The Neon project was deleted after the measurements.
