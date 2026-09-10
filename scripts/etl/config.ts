/**
 * ETL configuration — CLI flags, source/target connection resolution.
 *
 * Spec: docs/target/data-migration.md §2 (tooling), §3 (prereqs), §8.4 (the
 * parametrised telemetry cut).
 *
 * Sources (dev):
 *   - MySQL  : the running ddev MariaDB (host port auto-detected from
 *              `ddev describe -j`, since it changes on every `ddev restart`).
 *   - Mongo  : the ddev `mongo` service, published on host port 37017 by
 *              ../emax-latest-backend/.ddev/docker-compose.mongo-etl-expose.yaml
 * Target:
 *   - Supabase Postgres via the SESSION POOLER (`SUPABASE_DB_URL_POOLER`).
 *     The direct connection is IPv6-only and unreachable from this machine
 *     (STATUS §3). The pooler in session mode supports COPY / setval / DDL,
 *     just slower. At real cutover, pass `--target-dsn` for the direct URL.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = resolve(HERE, '../..');

// ---------------------------------------------------------------------------
// .env loader (no dotenv dependency in the ETL — parse the file directly)
// ---------------------------------------------------------------------------
function loadDotEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const dotenv = loadDotEnv(join(PROJECT_ROOT, '.env'));
function env(key: string): string | undefined {
  return process.env[key] ?? dotenv[key];
}

// ---------------------------------------------------------------------------
// CLI parsing — supports `--flag value`, `--flag=value`, and boolean `--flag`
// ---------------------------------------------------------------------------
export interface CliArgs {
  only: string[]; // run only these phase keys
  from?: string; // start at this phase key, run to the end
  dryRun: boolean; // extract + transform, print counts, write nothing
  truncate: boolean; // truncate each phase's target tables before loading
  since?: string; // telemetry hard floor date (YYYY-MM-DD)
  budgetMb?: number; // telemetry: stop loading older rows past this table size
  maxRows?: number; // telemetry: absolute row ceiling
  dropRawBodyBefore?: string; // telemetry: null out raw_body for rows older than this
  mysqlDsn?: string;
  mongoUri?: string;
  targetDsn?: string;
  limit?: number; // dev aid: cap non-telemetry extract row counts
  verbose: boolean;
}

function parseCli(argv: string[]): CliArgs {
  const raw: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith('--')) continue;
    const body = tok.slice(2);
    const eq = body.indexOf('=');
    if (eq !== -1) {
      raw[body.slice(0, eq)] = body.slice(eq + 1);
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      raw[body] = argv[++i];
    } else {
      raw[body] = true;
    }
  }
  const str = (k: string): string | undefined =>
    typeof raw[k] === 'string' ? (raw[k] as string) : undefined;
  const num = (k: string): number | undefined => {
    const v = str(k);
    return v === undefined ? undefined : Number(v);
  };
  return {
    only: (str('only') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    from: str('from'),
    dryRun: raw['dry-run'] === true || raw['dry-run'] === 'true',
    truncate: raw['truncate'] === true || raw['truncate'] === 'true',
    since: str('since'),
    budgetMb: num('budget-mb'),
    maxRows: num('max-rows'),
    dropRawBodyBefore: str('drop-rawbody-before'),
    mysqlDsn: str('mysql-dsn'),
    mongoUri: str('mongo-uri'),
    targetDsn: str('target-dsn'),
    limit: num('limit'),
    verbose: raw['verbose'] === true,
  };
}

export const args: CliArgs = parseCli(process.argv.slice(2));

// ---------------------------------------------------------------------------
// MySQL source — explicit flag > env > ddev auto-detect
// ---------------------------------------------------------------------------
interface MySqlConn {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

function ddevBackendDir(): string {
  return (
    env('ETL_DDEV_BACKEND_DIR') ??
    resolve(PROJECT_ROOT, '../emax-latest-backend')
  );
}

function ddevMysqlConn(): MySqlConn | null {
  const cwd = ddevBackendDir();
  if (!existsSync(join(cwd, '.ddev'))) return null;
  try {
    const json = execFileSync('ddev', ['describe', '-j'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const info = JSON.parse(json)?.raw?.dbinfo;
    if (!info?.published_port) return null;
    return {
      host: '127.0.0.1',
      port: Number(info.published_port),
      user: info.username ?? 'db',
      password: info.password ?? 'db',
      database: info.dbname ?? 'db',
    };
  } catch {
    return null;
  }
}

function parseMysqlDsn(dsn: string): MySqlConn {
  // mysql://user:pass@host:port/db
  const u = new URL(dsn);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  };
}

export function resolveMysql(): MySqlConn {
  const dsn = args.mysqlDsn ?? env('ETL_MYSQL_DSN');
  if (dsn) return parseMysqlDsn(dsn);
  const ddev = ddevMysqlConn();
  if (ddev) return ddev;
  throw new Error(
    'No MySQL source: pass --mysql-dsn, set ETL_MYSQL_DSN, or run ddev in ../emax-latest-backend',
  );
}

// ---------------------------------------------------------------------------
// Mongo source
// ---------------------------------------------------------------------------
export function resolveMongo(): { uri: string; db: string } {
  const uri =
    args.mongoUri ??
    env('ETL_MONGO_URI') ??
    'mongodb://db:db@127.0.0.1:37017/laravel_emax?authSource=admin';
  let db = 'laravel_emax';
  try {
    const path = new URL(uri).pathname.replace(/^\//, '');
    if (path) db = path;
  } catch {
    /* keep default */
  }
  return { uri, db: env('ETL_MONGO_DB') ?? db };
}

// ---------------------------------------------------------------------------
// Target Postgres
// ---------------------------------------------------------------------------
export function resolveTargetDsn(): string {
  const dsn =
    args.targetDsn ??
    env('ETL_TARGET_DSN') ??
    env('SUPABASE_DB_URL_POOLER') ??
    env('SUPABASE_DATABASE_URL');
  if (!dsn) {
    throw new Error(
      'No target DSN: pass --target-dsn, set ETL_TARGET_DSN, or SUPABASE_DB_URL_POOLER in .env',
    );
  }
  return dsn;
}

export function describeConfig(): string {
  const my = resolveMysql();
  const mo = resolveMongo();
  const tgt = new URL(resolveTargetDsn());
  return [
    `  mysql  : ${my.user}@${my.host}:${my.port}/${my.database}`,
    `  mongo  : ${mo.uri.replace(/\/\/[^@]*@/, '//***@')} (db ${mo.db})`,
    `  target : ${tgt.username}@${tgt.hostname}:${tgt.port || 5432}${tgt.pathname}`,
    `  mode   : ${args.dryRun ? 'DRY RUN' : 'WRITE'}${args.truncate ? ' + TRUNCATE' : ''}`,
  ].join('\n');
}
