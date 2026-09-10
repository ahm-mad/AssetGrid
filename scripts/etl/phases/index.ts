/**
 * Ordered phase registry — mirrors docs/target/data-migration.md §4.
 *
 * A phase not yet implemented is simply absent from this list; the orchestrator
 * handles `--only` / `--from` against whatever is registered.
 */

import type { Phase } from './types.ts';
import { phase as reference } from './10-reference.ts';
import { phase as authUsers } from './20-auth-users.ts';
import { phase as authz } from './30-authz.ts';
import { phase as catalog } from './40-catalog.ts';
import { phase as devices } from './50-devices.ts';
import { phase as billing } from './60-billing.ts';
import { phase as buildings } from './70-buildings.ts';
import { phase as marina } from './80-marina.ts';
import { phase as notifications } from './90-notifications.ts';
import { phase as storage } from './95-storage.ts';
import { phase as telemetry } from './99-telemetry.ts';
import { phase as finalise } from './99z-finalise.ts';

export const PHASES: Phase[] = [
  reference,
  authUsers,
  authz,
  catalog,
  devices,
  billing,
  buildings,
  marina,
  notifications,
  storage,
  telemetry,
  finalise,
];

export function selectPhases(only: string[], from?: string): Phase[] {
  let list = PHASES;
  if (from) {
    const i = list.findIndex((p) => p.key === from || p.key.startsWith(from));
    if (i === -1) throw new Error(`--from: no phase matching "${from}"`);
    list = list.slice(i);
  }
  if (only.length) {
    list = list.filter((p) => only.some((k) => p.key === k || p.key.startsWith(k)));
    if (list.length === 0) throw new Error(`--only: no phase matching ${only.join(', ')}`);
  }
  return list;
}
