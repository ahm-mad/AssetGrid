/** STUB — not yet implemented. See docs/target/data-migration.md. */
import type { Phase, PhaseResult } from './types.ts';
export const phase: Phase = {
  key: '99z-finalise',
  title: '99z-finalise (stub)',
  targetTables: [],
  async run(): Promise<PhaseResult> {
    return { rowsLoaded: 0, skipped: true, notes: 'stub — not implemented' };
  },
};
