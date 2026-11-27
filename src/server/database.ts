import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../db/schema";

export function connectDatabase(url: string) {
  const pool = new Pool({ connectionString: url, max: 5 });
  return { pool, db: drizzle(pool, { schema }) };
}

const processState = globalThis as typeof globalThis & { secureExamDatabase?: ReturnType<typeof connectDatabase> };

export function database() {
  if (!processState.secureExamDatabase) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
    processState.secureExamDatabase = connectDatabase(process.env.DATABASE_URL);
  }
  return processState.secureExamDatabase.db;
}

export type Tx = Parameters<Parameters<ReturnType<typeof database>["transaction"]>[0]>[0];
