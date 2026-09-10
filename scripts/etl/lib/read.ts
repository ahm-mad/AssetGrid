/**
 * Source read helpers (MySQL + Mongo).
 */

import type { RowDataPacket } from 'mysql2';
import { mysql, mongo } from './sources.ts';
import { args } from '../config.ts';

/** SELECT all rows. `--limit N` caps every non-telemetry extract for dev runs. */
export async function mysqlAll<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  opts: { cap?: boolean } = { cap: true },
): Promise<T[]> {
  let finalSql = sql;
  if (opts.cap && args.limit && !/\blimit\b/i.test(sql)) {
    finalSql = `${sql} limit ${args.limit}`;
  }
  const [rows] = await mysql().query<RowDataPacket[]>(finalSql, params);
  return rows as T[];
}

export async function mysqlOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await mysqlAll<T>(sql, params, { cap: false });
  return rows[0];
}

export async function mysqlCount(
  table: string,
  where?: string,
): Promise<number> {
  const row = await mysqlOne<{ c: number }>(
    `select count(*) c from \`${table}\`${where ? ` where ${where}` : ''}`,
  );
  return Number(row?.c ?? 0);
}

export async function mysqlTableExists(table: string): Promise<boolean> {
  const row = await mysqlOne<{ c: number }>(
    `select count(*) c from information_schema.tables
      where table_schema = database() and table_name = ?`,
    [table],
  );
  return Number(row?.c ?? 0) > 0;
}

/** Async-iterate a large MySQL result set without buffering it all. */
export async function* mysqlStream<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): AsyncGenerator<T> {
  // The promise-pool wraps a classic callback pool at `.pool`; its `.query()`
  // returns a Query object exposing a Node stream.
  const corePool = (mysql() as unknown as { pool: import('mysql2').Pool }).pool;
  const query = corePool.query(sql, params);
  const stream = (query as unknown as { stream(opts?: object): NodeJS.ReadableStream }).stream({
    highWaterMark: 500,
  });
  for await (const row of stream as AsyncIterable<T>) {
    yield row;
  }
}

export async function mongoCount(collection: string): Promise<number> {
  const db = await mongo();
  return db.collection(collection).estimatedDocumentCount();
}
