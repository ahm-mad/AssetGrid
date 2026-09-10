/**
 * Phase module contract. Each `NN-*.ts` file exports one `phase: Phase`.
 * The orchestrator (etl.ts) runs them in the array order of `phases/index.ts`,
 * which mirrors docs/target/data-migration.md §4.
 */

export interface PhaseResult {
  /** rows written to the target across all this phase's tables */
  rowsLoaded: number;
  /** rows read from the source (for reconciliation), if meaningful */
  sourceRows?: number;
  notes?: string;
  /** set when the phase decided there was nothing to do */
  skipped?: boolean;
}

export interface Phase {
  key: string;
  title: string;
  /** target tables this phase owns — used by `--truncate` and verify.ts */
  targetTables: string[];
  run(): Promise<PhaseResult>;
}
