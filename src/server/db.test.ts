// 메모리 PGlite에 마이그레이션을 적용하고 queries·actions를 실제로 돌려 본다.
import { describe, it, expect, beforeAll } from "vitest";
import { addDays, todayKST } from "../lib/date";

process.env.PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

type Mods = {
  db: typeof import("../db");
  q: typeof import("./queries");
  a: typeof import("./actions");
  data: typeof import("./data");
};
let m: Mods;
const today = todayKST();

beforeAll(async () => {
  const db = await import("../db");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(db.db as never, { migrationsFolder: "./drizzle" });
  m = { db, q: await import("./queries"), a: await import("./actions"), data: await import("./data") };
  const { postings } = db.schema;
  const base = { jobCategory: "구매", companyType: "대기업", employmentType: "신입 정규직", status: "진행중", fit: "B" };
  await db.db.insert(postings).values([
    { ...base, id: "울산A|구매", company: "울산A", title: "구매", location: "울산 남구", deadline: addDays(today, 10) },
    { ...base, id: "울산B|생산", company: "울산B", title: "생산", location: "울산", deadline: addDays(today, 12) },
    { ...base, id: "서울C|SCM", company: "서울C", title: "SCM", location: "서울", fit: "A", deadline: addDays(today, 3) },
    { ...base, id: "서울D|구매", company: "서울D", title: "구매", location: "서울", deadline: addDays(today, 20), decision: "예정", estHours: 4 },
  ]);
}, 60_000);

describe("받은편지함 · 숨김 규칙", () => {
  it("결정 필요(A·마감 임박)가 먼저, 그다음 마감 빠른 순", async () => {
    const inbox = await m.q.getInbox();
    expect(inbox.cards.map((c) => c.id)).toEqual(["서울C|SCM", "울산A|구매", "울산B|생산"]);
    expect(inbox.cards[0].reason).toBe("needDecision");
    expect(inbox.counts).toMatchObject({ new: 2, needDecision: 1, autoHidden: 0 });
    expect(inbox.cards[0].impact.fits).toBe(true);
  });

  it("관심 없음 + 이유 → 규칙이 생기고 비슷한 공고가 숨겨진다, 되돌리면 원래대로", async () => {
    expect(await m.a.decideInbox("울산A|구매", "x", { kind: "location", value: "울산" })).toEqual({ ok: true });
    let inbox = await m.q.getInbox();
    expect(inbox.cards.map((c) => c.id)).toEqual(["서울C|SCM"]);
    expect(inbox.counts.autoHidden).toBe(1);
    const rules = await m.q.listHideRules();
    expect(rules).toMatchObject([{ kind: "location", value: "울산", hiddenCount: 1 }]);
    const p = await m.q.getPosting("울산B|생산");
    expect(p?.decision).toBe(""); // 지원여부는 그대로

    expect(await m.a.undoDecision("울산A|구매")).toEqual({ ok: true });
    inbox = await m.q.getInbox();
    expect(inbox.cards.map((c) => c.id)).toEqual(["서울C|SCM", "울산A|구매", "울산B|생산"]);
    expect(await m.q.listHideRules()).toEqual([]);
    const [row] = await m.db.db.select().from(m.db.schema.postings).where((await import("drizzle-orm")).eq(m.db.schema.postings.id, "울산A|구매"));
    expect(row.userEditedFields).not.toContain("decision");
  });

  it("동기화로 새로 들어온 공고에 규칙을 적용하고, 규칙을 지우면 다시 보인다", async () => {
    await m.a.decideInbox("울산A|구매", "x", { kind: "location", value: "울산" });
    const { postings } = m.db.schema;
    await m.db.db.insert(postings).values({ id: "울산E|자재", company: "울산E", title: "자재", location: "울산 북구", status: "진행중" });
    expect(await m.data.applyHideRules(m.db.db, { postingIds: ["울산E|자재"] })).toBe(1);
    const [rule] = await m.q.listHideRules();
    expect(rule.hiddenCount).toBe(2);
    expect(await m.a.removeHideRule(rule.id)).toEqual({ ok: true });
    const ids = (await m.q.getInbox()).cards.map((c) => c.id);
    expect(ids).toContain("울산B|생산");
    expect(ids).toContain("울산E|자재");
  });
});

describe("오늘 할 일 · 지원 현황", () => {
  it("체크하면 진행률이 오르고 해제하면 되돌아간다", async () => {
    const t0 = await m.q.getToday();
    const task = t0.tasks.find((t) => t.postingId === "서울D|구매")!;
    expect(task).toBeTruthy();
    expect(await m.a.toggleTask(task.id, true)).toEqual({ ok: true });
    let p = await m.q.getPosting("서울D|구매");
    expect(p?.progress).toBe(task.progressTo);
    const t1 = await m.q.getToday();
    expect(t1.tasks.find((t) => t.id === task.id)?.done).toBe(true);

    expect(await m.a.toggleTask(task.id, false)).toEqual({ ok: true });
    p = await m.q.getPosting("서울D|구매");
    expect(p?.progress).toBe(task.progressFrom);
  });

  it("제출하면 지원 현황 서류 칸으로, 단계를 바꾸면 다음 일정이 붙는다", async () => {
    expect(await m.a.markSubmitted("서울D|구매")).toEqual({ ok: true });
    let board = await m.q.getBoard();
    expect(board.columns.find((c) => c.key === "준비 중")!.cards).toHaveLength(0);
    expect(board.columns.find((c) => c.key === "서류")!.cards[0]).toMatchObject({ id: "서울D|구매", stage: "서류 결과 대기" });

    const date = addDays(today, 5);
    expect(await m.a.setStage("서울D|구매", "서류 합격 · 1차면접 대기", { kind: "면접", title: "서울D 1차면접", date })).toEqual({ ok: true });
    board = await m.q.getBoard();
    const card = board.columns.find((c) => c.key === "1차면접")!.cards[0];
    expect(card.nextEvent).toMatchObject({ kind: "면접", date });
    // 면접 준비가 일정에 잡힌다
    const sched = await m.q.getSchedule(7);
    expect(sched.days.some((d) => d.blocks.some((b) => b.kind === "prep"))).toBe(true);
  });

  it("설정 저장과 시간 늘리기 해결책", async () => {
    expect(await m.a.updateSettings({ weekdayHours: 25 })).toMatchObject({ ok: false });
    expect(await m.a.updateSettings({ weekdayHours: 2 })).toEqual({ ok: true });
    const d = addDays(today, 1);
    expect(await m.a.applyFix({ id: "x", kind: "addHours", label: "", detail: "", date: d, hours: 2 })).toEqual({ ok: true });
    const s = await m.q.getSettings();
    expect(s.weekdayHours).toBe(2);
    expect(s.overrides[d]).toBeGreaterThanOrEqual(4);
    expect(s.weekendHours).toBe(6);
  });

  it("공고 목록 필터·정렬·페이지", async () => {
    const all = await m.q.listPostings({ status: "all", sort: "fit", limit: 2 });
    expect(all.total).toBe(5);
    expect(all.items).toHaveLength(2);
    expect(all.items[0].fit).toBe("A");
    expect((await m.q.listPostings({ q: "울산" })).total).toBe(3);
    expect((await m.q.listPostings({ decision: ["지원완료"] })).items.map((x) => x.id)).toEqual(["서울D|구매"]);
  });
});
