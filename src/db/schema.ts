import {
  pgTable, text, date, integer, real, boolean, timestamp, jsonb, serial, index,
} from "drizzle-orm/pg-core";

// 공고. id는 기존 JSON과 같은 「기업명|공고명」 형식을 유지한다.
export const postings = pgTable("postings", {
  id: text("id").primaryKey(),
  company: text("company").notNull(),
  title: text("title").notNull(),
  jobCategory: text("job_category").notNull().default(""),
  companyType: text("company_type").notNull().default(""),
  companyTypeBasis: text("company_type_basis"),
  employmentType: text("employment_type").notNull().default(""),
  location: text("location").notNull().default(""),
  openDate: date("open_date"),
  deadline: date("deadline"), // null = 수시 또는 미정
  deadlineTime: text("deadline_time"), // "HH:MM", 모르면 null
  rolling: boolean("rolling").notNull().default(false), // 수시 채용
  fit: text("fit").notNull().default(""), // A | B | C
  decision: text("decision").notNull().default(""), // '' | 예정 | x | 지원완료
  status: text("status").notNull().default("진행중"), // 진행중 | 마감
  source: text("source").notNull().default(""),
  url: text("url").notNull().default(""),
  notes: text("notes").notNull().default(""),
  surveyedAt: date("surveyed_at"),
  origin: text("origin").notNull().default("collected"), // collected | manual
  // 일정 계획용: 지원서 준비에 드는 예상 시간과 진행 정도
  estHours: real("est_hours"),
  progress: integer("progress").notNull().default(0), // 0~100
  // 앱에서 직접 고친 필드. 동기화가 덮어쓰지 않는다.
  userEditedFields: text("user_edited_fields").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("postings_deadline_idx").on(t.deadline), index("postings_status_idx").on(t.status)]);

// 지원현황. 기존 JSON의 지원현황[] 항목과 1:1.
export const applications = pgTable("applications", {
  id: text("id").primaryKey(),
  postingId: text("posting_id"), // 공고 목록에 없는 지원도 있어 nullable
  company: text("company").notNull(),
  title: text("title").notNull(),
  jobCategory: text("job_category").notNull().default(""),
  appliedAt: date("applied_at"),
  deadline: date("deadline"),
  stage: text("stage").notNull(), // meta.전형단계 값
  historyNote: text("history_note").notNull().default(""), // 기존 「이력」 자유 텍스트
  log: jsonb("log").$type<{ at: string; from: string; to: string }[]>().notNull().default([]),
  notes: text("notes").notNull().default(""),
  source: text("source").notNull().default(""),
  url: text("url").notNull().default(""),
  userEditedFields: text("user_edited_fields").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 일정. 마감일은 postings.deadline에서 바로 읽고, 그 외 일정(서류발표·인적성·면접 등)을 여기 둔다.
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  postingId: text("posting_id"),
  applicationId: text("application_id"),
  kind: text("kind").notNull(), // 서류발표 | 인적성 | 면접 | 설명회 | 마감 | 기타
  title: text("title").notNull(),
  date: date("date").notNull(),
  time: text("time"), // "HH:MM"
  notes: text("notes").notNull().default(""),
  done: boolean("done").notNull().default(false),
  origin: text("origin").notNull().default("manual"), // collected | manual
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("events_date_idx").on(t.date)]);

// 하루 계획. 입력(가용 시간 등)과 결과(시간 블록)를 저장한다.
export const dailyPlans = pgTable("daily_plans", {
  date: date("date").primaryKey(),
  availableHours: real("available_hours").notNull(),
  input: jsonb("input").notNull(),
  plan: jsonb("plan").notNull(),
  checked: jsonb("checked").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  endpoint: text("endpoint").primaryKey(),
  keys: jsonb("keys").$type<{ p256dh: string; auth: string }>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 기존 JSON의 meta(전형단계·적합도 설명 등)를 그대로 보관한다.
export const meta = pgTable("meta", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export type Posting = typeof postings.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type Event = typeof events.$inferSelect;
