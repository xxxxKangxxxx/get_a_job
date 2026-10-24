// 구글 FreeBusy 결과를 백엔드의 busy_blocks 표에 넣는다 (D8). 인프라는 source="google" 행만 지우고 다시 넣는다.
import { and, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import type { BusyRow } from "./place";

const { busyBlocks } = schema;

export async function replaceGoogleBusy(from: string, to: string, rows: BusyRow[]): Promise<number> {
  await db.delete(busyBlocks).where(and(eq(busyBlocks.source, "google"), gte(busyBlocks.date, from), lte(busyBlocks.date, to)));
  for (let i = 0; i < rows.length; i += 200) {
    await db.insert(busyBlocks).values(rows.slice(i, i + 200));
  }
  return rows.length;
}
