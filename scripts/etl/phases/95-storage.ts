/**
 * Phase 10 — storage files (spec §9).
 *
 * Walks the old backend's `storage/app/` tree and uploads each file to a
 * Supabase Storage bucket with the service-role key, preserving the relative
 * path. Records `etl.file_map(old_path, bucket, object_path)` so later phases
 * (and a follow-up column rewrite) can translate stored paths.
 *
 * Mapping (only the buckets that exist are used; others are skipped + logged):
 *   contracts/*         → bucket `contracts`
 *   public/products/*   → bucket `product-images`   (if it exists)
 *   public/devices/*    → bucket `device-images`    (if it exists)
 *   everything else     → logged to etl.unresolved, not uploaded
 *
 * The dev backend's storage dir is empty, so this is a no-op there; it is
 * built for the cutover.  `marinas.uploaded_svg` stays inline text (v1 parity).
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, relative, resolve, extname } from 'node:path';
import type { Phase, PhaseResult } from './types.ts';
import { pgPool } from '../lib/sources.ts';
import { PROJECT_ROOT } from '../config.ts';
import { unresolved } from '../lib/unresolved.ts';
import { info, warn } from '../lib/log.ts';
import { args } from '../config.ts';

const KEY = '95-storage';

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

interface Mapping {
  prefix: string; // relative to storage/app
  bucket: string;
}
const MAPPINGS: Mapping[] = [
  { prefix: 'contracts', bucket: 'contracts' },
  { prefix: 'public/products', bucket: 'product-images' },
  { prefix: 'public/product-images', bucket: 'product-images' },
  { prefix: 'public/devices', bucket: 'device-images' },
  { prefix: 'public/device-images', bucket: 'device-images' },
];

function* walk(dir: string): Generator<string> {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && entry.name !== '.gitignore') yield full;
  }
}

export const phase: Phase = {
  key: KEY,
  title: 'Storage files → Supabase Storage buckets',
  targetTables: [],

  async run(): Promise<PhaseResult> {
    const pg = pgPool();
    const storageRoot =
      process.env.ETL_BACKEND_STORAGE ??
      resolve(PROJECT_ROOT, '../emax-latest-backend/storage/app');

    if (!existsSync(storageRoot)) {
      return { rowsLoaded: 0, skipped: true, notes: `no storage dir at ${storageRoot}` };
    }

    const files = [...walk(storageRoot)];
    if (files.length === 0) {
      return { rowsLoaded: 0, skipped: true, notes: 'storage/app is empty (dev)' };
    }

    // which buckets exist
    const buckets = new Set(
      (await pg.query<{ id: string }>('select id from storage.buckets')).rows.map((r) => r.id),
    );

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? readEnv('NEXT_PUBLIC_SUPABASE_URL');
    const key = process.env.SUPABASE_SECRET_KEY ?? readEnv('SUPABASE_SECRET_KEY');
    if (!url || !key) {
      warn('storage upload needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY');
      return { rowsLoaded: 0, skipped: true, notes: 'missing Supabase REST credentials' };
    }

    let uploaded = 0;
    for (const file of files) {
      const rel = relative(storageRoot, file).split('\\').join('/');
      const mapping = MAPPINGS.find((m) => rel === m.prefix || rel.startsWith(m.prefix + '/'));
      if (!mapping) {
        unresolved(KEY, 'storage', 'path', rel, null, 'no bucket mapping — not uploaded');
        continue;
      }
      if (!buckets.has(mapping.bucket)) {
        unresolved(KEY, 'storage', 'bucket', mapping.bucket, rel, `bucket "${mapping.bucket}" does not exist — not uploaded`);
        continue;
      }
      const objectPath = rel.slice(mapping.prefix.length + 1) || rel.split('/').pop()!;
      if (args.dryRun) {
        uploaded++;
        continue;
      }
      const body = readFileSync(file);
      const contentType = CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
      const res = await fetch(
        `${url}/storage/v1/object/${mapping.bucket}/${encodeURI(objectPath)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': contentType,
            'x-upsert': 'true',
          },
          body: new Uint8Array(body),
        },
      );
      if (!res.ok && res.status !== 409) {
        unresolved(KEY, 'storage', 'upload', rel, null, `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        continue;
      }
      await pg.query(
        `insert into etl.file_map (old_path, bucket, object_path, bytes)
         values ($1, $2, $3, $4)
         on conflict (old_path) do update set bucket = excluded.bucket, object_path = excluded.object_path, bytes = excluded.bytes`,
        [rel, mapping.bucket, objectPath, statSync(file).size],
      );
      uploaded++;
    }

    info(`   uploaded ${uploaded}/${files.length} files`);
    return { rowsLoaded: uploaded, sourceRows: files.length };
  },
};

function readEnv(name: string): string | undefined {
  try {
    const line = readFileSync(join(PROJECT_ROOT, '.env'), 'utf8')
      .split('\n')
      .find((l) => l.startsWith(name + '='));
    return line?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
  } catch {
    return undefined;
  }
}
