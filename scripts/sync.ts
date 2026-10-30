// 공고 원본 JSON(기본 data/postings.json, 환경변수 POSTINGS_JSON) → DB 동기화.  사용법: pnpm sync [json 경로]
// - id 기준 upsert. 두 번 돌려도 중복이 생기지 않는다.
// - 앱에서 직접 고친 필드(userEditedFields)는 덮어쓰지 않는다.
// - JSON 원본은 읽기만 한다.
// - 처음 들어온 공고는 받은편지함(new)으로 가고, 숨김 규칙에 맞으면 자동으로 숨긴다(지원여부는 '' 그대로).
import "./env";
import { readFileSync } from "node:fs";
import { sql, and, eq } from "drizzle-orm";
import { postingsJsonPath } from "./paths";
import { eventKindFor } from "./stage-event";

type SrcPosting = {
  id: string; 조사일?: string; 기업명: string; 기업형태?: string; 공고명: string; 직무분류?: string;
  근무지?: string; 고용형태?: string; 접수시작?: string | null; 접수마감?: string | null; 적합도?: string;
  지원여부?: string; 비고?: string; 출처?: string; 링크?: string; 상태?: string; 기업형태근거?: string;
};
type SrcApp = {
  id: string; 지원일?: string | null; 기업명: string; 공고명: string; 직무분류?: string; 접수마감?: string | null;
  현재단계: string; 다음일정?: string | null; 이력?: string; 비고?: string; 출처?: string; 링크?: string;
};

const isDate = (s?: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const asDate = (s?: string | null) => (isDate(s) ? s! : null);

async function main() {
  const { db, schema, usingPglite } = await import("../src/db");
  const { applyHideRules } = await import("../src/server/data");
  const { postings, applications, events, meta } = schema;
  const path = process.argv[2] ?? postingsJsonPath();
  const data = JSON.parse(readFileSync(path, "utf-8")) as { meta: unknown; 공고: SrcPosting[]; 지원현황: SrcApp[] };

  // ---- 공고 ----
  const existing = await db.select({ id: postings.id, edited: postings.userEditedFields }).from(postings);
  const editedById = new Map(existing.map((r) => [r.id, r.edited]));

  const rows = data.공고.map((p) => ({
    id: p.id,
    company: p.기업명,
    title: p.공고명,
    jobCategory: p.직무분류 ?? "",
    companyType: p.기업형태 ?? "",
    companyTypeBasis: p.기업형태근거 ?? null,
    employmentType: p.고용형태 ?? "",
    location: p.근무지 ?? "",
    openDate: asDate(p.접수시작),
    deadline: asDate(p.접수마감),
    rolling: p.접수마감 === "수시",
    fit: p.적합도 ?? "",
    decision: p.지원여부 ?? "",
    status: p.상태 ?? "진행중",
    source: p.출처 ?? "",
    url: p.링크 ?? "",
    notes: p.비고 ?? "",
    surveyedAt: asDate(p.조사일),
    origin: "collected" as const,
    // 새 공고에만 쓰인다 (기존 공고는 아래 upsert에서 건드리지 않음)
    inboxState: (p.지원여부 ?? "") === "" ? "new" : "seen",
  }));
  const newIds = rows.filter((r) => !editedById.has(r.id)).map((r) => r.id);

  // 덮어쓰지 않을 필드 조합이 같은 행끼리 묶어 한 번에 upsert한다.
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = [...(editedById.get(r.id) ?? [])].sort().join(",");
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const updatable = Object.keys(rows[0]).filter((k) => !["id", "origin", "inboxState"].includes(k));
  const colName = (k: string) => (postings as unknown as Record<string, { name: string }>)[k].name;

  for (const [key, group] of groups) {
    const skip = new Set(key ? key.split(",") : []);
    const set: Record<string, unknown> = { updatedAt: sql`now()` };
    for (const k of updatable) if (!skip.has(k)) set[k] = sql.raw(`excluded."${colName(k)}"`);
    for (let i = 0; i < group.length; i += 200) {
      await db.insert(postings).values(group.slice(i, i + 200))
        .onConflictDoUpdate({ target: postings.id, set });
    }
  }

  const autoHidden = await applyHideRules(db, { postingIds: newIds });

  // ---- 지원현황 ----
  const postingIds = new Set(rows.map((r) => r.id));
  const existingApps = await db.select({ id: applications.id, edited: applications.userEditedFields }).from(applications);
  const appEdited = new Map(existingApps.map((r) => [r.id, new Set(r.edited)]));
  let newEvents = 0;

  for (const a of data.지원현황) {
    const row = {
      id: a.id,
      postingId: postingIds.has(a.id) ? a.id : null,
      company: a.기업명,
      title: a.공고명,
      jobCategory: a.직무분류 ?? "",
      appliedAt: asDate(a.지원일),
      deadline: asDate(a.접수마감),
      stage: a.현재단계,
      historyNote: a.이력 ?? "",
      notes: a.비고 ?? "",
      source: a.출처 ?? "",
      url: a.링크 ?? "",
    };
    const skip = appEdited.get(a.id) ?? new Set<string>();
    const set: Record<string, unknown> = { updatedAt: sql`now()` };
    for (const [k, v] of Object.entries(row)) if (k !== "id" && !skip.has(k)) set[k] = v;
    await db.insert(applications).values(row).onConflictDoUpdate({ target: applications.id, set });

    // 다음일정 → events (같은 지원·같은 날짜의 수집 일정이 이미 있으면 건너뛴다)
    if (isDate(a.다음일정) && !["최종 합격", "불합격", "불참·포기"].includes(a.현재단계)) {
      const dup = await db.select({ id: events.id }).from(events).where(and(
        eq(events.applicationId, a.id), eq(events.date, a.다음일정!), eq(events.origin, "collected"),
      ));
      if (dup.length === 0) {
        const { kind, label } = eventKindFor(a.현재단계);
        await db.insert(events).values({
          applicationId: a.id, postingId: row.postingId, kind,
          title: `${a.기업명} ${label}`, date: a.다음일정!, origin: "collected",
        });
        newEvents++;
      }
    }
  }

  // ---- meta ----
  await db.insert(meta).values({ key: "source_meta", value: data.meta as object })
    .onConflictDoUpdate({ target: meta.key, set: { value: data.meta as object } });
  await db.insert(meta).values({ key: "last_sync", value: { at: new Date().toISOString(), path } })
    .onConflictDoUpdate({ target: meta.key, set: { value: { at: new Date().toISOString(), path } } });

  const [{ n: pn }] = await db.select({ n: sql<number>`count(*)::int` }).from(postings);
  const [{ n: live }] = await db.select({ n: sql<number>`count(*)::int` }).from(postings).where(eq(postings.status, "진행중"));
  const [{ n: an }] = await db.select({ n: sql<number>`count(*)::int` }).from(applications);
  const [{ n: en }] = await db.select({ n: sql<number>`count(*)::int` }).from(events);
  console.log(JSON.stringify({
    DB: usingPglite ? "로컬 PGlite" : "Neon",
    원본: { 공고: data.공고.length, 지원현황: data.지원현황.length },
    DB건수: { 공고: pn, 진행중: live, 지원현황: an, 일정: en },
    새일정: newEvents,
    새공고: newIds.length,
    자동숨김: autoHidden,
    수정보존그룹: [...groups.keys()].filter(Boolean),
  }, null, 1));
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
