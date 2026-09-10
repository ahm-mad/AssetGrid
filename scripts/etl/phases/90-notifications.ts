/** STUB — not yet implemented. See docs/target/data-migration.md. */
import type { Phase, PhaseResult } from './types.ts';
export const phase: Phase = {
  key: '90-notifications',
  title: '90-notifications (stub)',
  targetTables: [],
  async run(): Promise<PhaseResult> {
    return { rowsLoaded: 0, skipped: true, notes: 'stub — not implemented' };
  },
};
