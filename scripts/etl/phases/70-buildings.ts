/** STUB — not yet implemented. See docs/target/data-migration.md. */
import type { Phase, PhaseResult } from './types.ts';
export const phase: Phase = {
  key: '70-buildings',
  title: '70-buildings (stub)',
  targetTables: [],
  async run(): Promise<PhaseResult> {
    return { rowsLoaded: 0, skipped: true, notes: 'stub — not implemented' };
  },
};
