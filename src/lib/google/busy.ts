// 구글 FreeBusy 결과를 백엔드의 busy_blocks 표에 넣는다 (D8). 인프라는 이 표를 채우기만 한다.
// busy_blocks(date, start_time, end_time, title, source) — 총괄 확정 — 백엔드 schema.ts 소유라 SQL로 직접 쓴다.
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { BusyRow } from "./place";

export async function replaceGoogleBusy(from: string, to: string, rows: BusyRow[]): Promise<number> {
  await db.execute(sql`delete from busy_blocks where source = 'google' and date >= ${from} and date <= ${to}`);
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const values = sql.join(chunk.map((r) => sql`(${r.date}, ${r.start}, ${r.end}, ${r.title}, ${r.source})`), sql`, `);
    await db.execute(sql`insert into busy_blocks (date, start_time, end_time, title, source) values ${values}`);
  }
  return rows.length;
}
