-- ============================================================================
-- Revert telemetry_daily_rollup — user decision, 2026-09-11 (supersedes
-- ADR-038, see decisions.md ADR-039).
--
-- The breadth-over-depth daily-rollup design (20260911180407) is reverted.
-- The user wants telemetry to match the legacy project 1:1 (real raw packets,
-- same shape as the old device_values/device_values_dump/Mongo rows) rather
-- than a squeezed/aggregated tier, at least for this first live version.
-- Space is instead managed by loading only a short recent window (the last
-- 6 hours) via scripts/etl/phases/99-telemetry.ts. A future revisit of
-- longer-history telemetry (the user has a different approach in mind) is
-- deferred, not designed here.
-- ============================================================================

drop table if exists public.telemetry_daily_rollup;
