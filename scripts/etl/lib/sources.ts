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

export function pgPool(): pg.Pool {
  if (!_pg) {
    _pg = new pg.Pool({
      connectionString: resolveTargetDsn(),
      max: 4,
      // pooler can be slow; give statements room
      statement_timeout: 15 * 60 * 1000,
      query_timeout: 15 * 60 * 1000,
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
