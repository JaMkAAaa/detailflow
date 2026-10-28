import { Pool } from "pg";

let pool: Pool | undefined;

function db() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return (pool ??= new Pool({ connectionString }));
}

export async function one<T extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
  const result = await db().query(sql, params);
  const row = result.rows[0] as T | undefined;
  if (!row) throw new Error("Zapytanie E2E nie zwróciło wiersza.");
  return row;
}

export async function many<T extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
  const result = await db().query(sql, params);
  return result.rows as T[];
}

export async function exec(sql: string, params: unknown[] = []) {
  await db().query(sql, params);
}
