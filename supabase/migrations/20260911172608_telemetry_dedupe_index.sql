-- ============================================================================
-- Telemetry dedupe index — makes the ETL's telemetry load idempotent.
--
--   `telemetry.id` is a fresh identity column (NOT a preserved source id, per
--   ADR-021 — the three legacy stores don't share one id space). The ETL's
--   in-memory dedupe set (data-migration.md §8.2 key:
--   `(dev_eui, created_at, coalesce(legacy_id, -1))`) only guards a SINGLE run
--   — a second `etl.ts --only 99-telemetry` invocation without `--truncate`
--   had no way to know a row was already loaded and inserted a full duplicate
--   batch (caught during the Phase N+1 dev proof-run, 2026-09-11).
--
--   This unique index enforces the same key at the database level, so the
--   loader can `ON CONFLICT ... DO NOTHING` and re-runs (including a resumed
--   crash, or two processes racing) converge instead of duplicating.
--   `created_at` is the partition key, so the index is created on the
--   partitioned parent and Postgres propagates it to every existing partition
--   now and every partition `create_telemetry_partition()` adds later.
-- ============================================================================

create unique index if not exists telemetry_dedupe_idx
  on public.telemetry (dev_eui, created_at, (coalesce(legacy_id, -1)));
