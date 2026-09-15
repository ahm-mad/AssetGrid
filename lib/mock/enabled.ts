/**
 * UI-only session flag (see .env). The live Supabase project behind this
 * app was torn down (ADR-047) and this session's scope is frontend-only —
 * so the DAL and page data-fetchers short-circuit to dummy data instead of
 * touching Supabase at all. Every call site that checks this must fall back
 * to the real path when it's false, so flipping this off (or deleting
 * UI_MOCK_MODE from .env) returns the app to its normal backend-driven
 * behavior with no other code changes.
 */
export const UI_MOCK = process.env.UI_MOCK_MODE === 'true'
