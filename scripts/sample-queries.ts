// 실제 DB로 queries를 돌려 결과를 확인한다.
//   pnpm tsx scripts/sample-queries.ts           지금 DB 그대로 읽기만
//   pnpm tsx scripts/sample-queries.ts --demo    적합도 A 공고 몇 건을 "예정"으로 바꾸고 면접 일정을 넣은 뒤 읽기
// --demo는 DB를 바꾸므로 복사본에서 돌린다:  PGLITE_DIR=/tmp/복사본 pnpm tsx scripts/sample-queries.ts --demo
import "./env";

async function main() {
  const demo = process.argv.includes("--demo");
  const q = await import("../src/server/queries");
  const a = await import("../src/server/actions");

  if (demo) {
    const inbox = await q.getInbox();
    const picks = inbox.cards.filter((c) => c.fit === "A" && c.deadline).slice(0, 6);
    for (const c of picks) await a.decideInbox(c.id, "예정");
    if (picks[0]) await a.updatePosting(picks[0].id, { progress: 30, estHours: 5 });
    const board = await q.getBoard();
    const active = board.columns.flatMap((col) => col.cards).find((c) => c.column === "서류" || c.column === "인적성");
    const { addDays, todayKST } = await import("../src/lib/date");
    await a.addEvent({
      kind: "면접", title: `${active?.company ?? "예시회사"} 1차면접`, date: addDays(todayKST(), 4), time: "14:00",
      applicationId: active?.id ?? null, postingId: active?.postingId ?? null,
    });
    const rest = (await q.getInbox()).cards.find((c) => c.fit !== "A" && c.jobCategory);
    if (rest) await a.decideInbox(rest.id, "x", { kind: "jobCategory", value: rest.jobCategory });
    console.log(`# 데모 준비: 예정 ${picks.length}건, 면접 1건, 숨김 규칙 ${rest ? 1 : 0}건\n`);
  }

  const today = await q.getToday();
  const inbox = await q.getInbox();
  const board = await q.getBoard();
  const rules = await q.listHideRules();

  console.log("## getToday()");
  console.log(JSON.stringify({
    ...today,
    week: today.week.map((d) => ({ date: d.date, capacity: d.capacity, used: d.used, overloaded: d.overloaded,
      blocks: d.blocks.map((b) => `${b.company} ${b.label} ${b.hours}h${b.finishes ? " ✓" : ""}`), deadlines: d.deadlines.map((x) => x.company), events: d.events.map((e) => e.title) })),
  }, null, 1));

  console.log("\n## getInbox() — 앞 5장");
  console.log(JSON.stringify({
    counts: inbox.counts, total: inbox.cards.length,
    cards: inbox.cards.slice(0, 5).map((c) => ({ company: c.company, title: c.title, fit: c.fit, deadline: c.deadline, dday: c.dday, reason: c.reason, impact: c.impact })),
  }, null, 1));

  console.log("\n## getBoard()");
  console.log(JSON.stringify({
    totals: board.totals, stages: board.stages.length,
    columns: board.columns.map((c) => ({ key: c.key, n: c.cards.length, cards: c.cards.slice(0, 3).map((x) => `${x.company} · ${x.stage}${x.nextEvent ? ` · 다음 ${x.nextEvent.date} ${x.nextEvent.title}` : ""}`) })),
  }, null, 1));

  console.log("\n## listHideRules()");
  console.log(JSON.stringify(rules, null, 1));
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
