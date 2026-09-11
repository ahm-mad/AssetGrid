/**
 * Connection factories for the three stores. Lazy singletons — a phase module
 * calls `mysql()` / `mongo()` / `pg()` and the orchestrator closes them at the
 * end via `closeAll()`.
 */

import mysqlDriver from 'mysql2/promise';
import type { Pool as MysqlPool } from 'mysql2/promise';
import { MongoClient, type Db } from 'mongodb';
import pg from 'pg';
import { resolveMysql, resolveMongo, resolveTargetDsn } from '../config.ts';

let _mysql: MysqlPool | undefined;
let _mongoClient: MongoClient | undefined;
let _mongoDb: Db | undefined;
let _pg: pg.Pool | undefined;

export function mysql(): MysqlPool {
  if (!_mysql) {
    const c = resolveMysql();
    _mysql = mysqlDriver.createPool({
      host: c.host,
      port: c.port,
      user: c.user,
      password: c.password,
      database: c.database,
      connectionLimit: 4,
      // the old columns are latin-ish utf8mb4; keep bigints as strings so we
      // never lose precision, and dates as strings so we control tz coercion.
      dateStrings: true,
      supportBigNumbers: true,
      bigNumberStrings: true,
      multipleStatements: false,
    });
  }
  return _mysql;
}

export async function mongo(): Promise<Db> {
  if (!_mongoDb) {
    const { uri, db } = resolveMongo();
    _mongoClient = new MongoClient(uri, { maxPoolSize: 4 });
    await _mongoClient.connect();
    _mongoDb = _mongoClient.db(db);
  }
  return _mongoDb;
}

// Supabase sets `default_transaction_read_only = on` at the database level
// while a free-tier project is over its storage budget (observed 2026-09-11
// at 832MB / 500MB) — and re-asserts it even after an `ALTER DATABASE`
// override, so it's enforced per-connection, not just a one-time default.
// It's a soft session-level GUC, not a hard replica/disk lock, so a session
// can opt out — which the ETL needs to do to delete data back under budget.
// A pg.Pool 'connect' *event* handler doesn't work here: pg does not await
// it before handing the client out, so a query issued right after `connect()`
// can race the SET and still see read-only (observed as a
// "client already executing a query" warning under load). Subclassing
// Client so the SET is awaited inside `connect()` itself closes that race.
class ReadWriteClient extends pg.Client {
  // pg-pool (verified in node_modules/pg-pool/index.js) only ever calls the
  // CALLBACK form: `client.connect((err) => ...)`. The extra SET must
  // complete before that callback fires, or the pool can hand out a client
  // that hasn't opted out of read-only yet — a `pool.on('connect', ...)`
  // listener doesn't get awaited by pg, which raced in practice. Typed loosely
  // (not matching pg.Client's full overload set) since only this call shape
  // needs to work; cast at the Pool constructor call site.
  // @ts-expect-error -- intentionally narrower than pg.Client's full connect() overload set; see comment above
  connect(callback: (err?: Error) => void): void {
    super.connect((err?: Error) => {
      if (err) { callback(err); return; }
      this.query('set default_transaction_read_only = off', (setErr: Error | undefined) => callback(setErr));
    });
  }
}

export function pgPool(): pg.Pool {
  if (!_pg) {
    _pg = new pg.Pool({
      connectionString: resolveTargetDsn(),
      max: 4,
      // pooler can be slow; give statements room
      statement_timeout: 15 * 60 * 1000,
      query_timeout: 15 * 60 * 1000,
      Client: ReadWriteClient as unknown as typeof pg.Client,
    });
  }
  return _pg;
}

/** Run `fn` inside a single dedicated client (needed for COPY / transactions). */
export async function withPgClient<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pgPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closeAll(): Promise<void> {
  await Promise.allSettled([
    _mysql?.end(),
    _mongoClient?.close(),
    _pg?.end(),
  ]);
  _mysql = _mongoClient = _mongoDb = _pg = undefined;
}
