import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

// DATABASE_URL이 있으면 Neon, 없으면 로컬 개발용 PGlite(.pglite 폴더)를 쓴다.
// PGlite는 한 번에 한 프로세스만 열 수 있으니 dev 서버와 sync 스크립트를 동시에 돌리지 않는다.
function createDb(): DB {
  const url = process.env.DATABASE_URL;
  if (url) return drizzleNeon(neon(url), { schema }) as unknown as DB;
  if (process.env.NODE_ENV === "production") throw new Error("DATABASE_URL이 설정되지 않았다");
  const client = new PGlite(process.env.PGLITE_DIR ?? "./.pglite");
  return drizzlePglite(client, { schema }) as unknown as DB;
}

const g = globalThis as unknown as { __db?: DB };
export const db: DB = g.__db ?? (g.__db = createDb());
export const usingPglite = !process.env.DATABASE_URL;
export { schema };
