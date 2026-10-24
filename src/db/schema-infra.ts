// 인프라(구글 캘린더 연동)용 테이블. 기존 테이블(schema.ts)은 건드리지 않는다.
// 마이그레이션 생성은 병합 후 총괄이 한다 (drizzle.config.ts의 schema에 이 파일 추가 필요).
import { pgTable, text, timestamp, date } from "drizzle-orm/pg-core";

// 연결된 구글 계정. 혼자 쓰는 앱이라 행은 하나(id = "me")만 쓴다.
export const googleAccounts = pgTable("google_accounts", {
  id: text("id").primaryKey().default("me"),
  email: text("email"),
  refreshToken: text("refresh_token").notNull(),
  accessToken: text("access_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  scope: text("scope").notNull().default(""),
  /** 앱 전용 캘린더 "취업 일정"의 id */
  calendarId: text("calendar_id"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncError: text("last_sync_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 앱 항목 ↔ 구글 이벤트 매핑.
// key 예: "period:<postingId>", "event:<eventId>", "block:<date>:<itemId>:<n>"
export const googleEventLinks = pgTable("google_event_links", {
  key: text("key").primaryKey(),
  calendarId: text("calendar_id").notNull(),
  googleEventId: text("google_event_id").notNull(),
  /** 마지막으로 보낸 내용의 해시. 같으면 다시 보내지 않는다 */
  hash: text("hash").notNull(),
  /** 이 항목의 (시작) 날짜. 지난 항목은 지우지 않고 남겨 둔다 */
  date: date("date").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GoogleAccount = typeof googleAccounts.$inferSelect;
