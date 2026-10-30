// 지원 계획·제출·전형 결과를 앱 DB에 바로 기록한다 (track-applications 스킬이 쓴다).
//   pnpm track find <키워드>
//   pnpm track plan|unplan|skip|unskip <키워드> [--pick "공고명"]
//   pnpm track apply <키워드> [--pick "공고명"] [--date YYYY-MM-DD]
//   pnpm track step <키워드> [--pick "공고명"] [--stage "전형단계"] [--date YYYY-MM-DD] [--time HH:MM]
// 키워드는 기업명이나 공고명 일부. 후보가 여럿이면 목록을 보여 주고 끝낸다(--pick으로 다시 실행).
// justdo 연동이 설정돼 있으면 끝에 접수 기간을 다시 보낸다.
import "./env";
import { parseArgs } from "node:util";
import { eventKindFor } from "./stage-event";

const ACTIONS = ["find", "plan", "unplan", "skip", "unskip", "apply", "step"] as const;
type Action = (typeof ACTIONS)[number];

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { pick: { type: "string" }, date: { type: "string" }, time: { type: "string" }, stage: { type: "string" } },
  });
  const [action, keyword] = positionals as [Action, string];
  if (!ACTIONS.includes(action) || !keyword) {
    console.error("사용법: pnpm track <find|plan|unplan|skip|unskip|apply|step> <키워드> [--pick 공고명] [--date] [--time] [--stage]");
    process.exit(1);
  }

  const { db, schema } = await import("../src/db");
  const { listPostings } = await import("../src/server/queries");
  const { loadSourceMeta } = await import("../src/server/data");
  const actions = await import("../src/server/actions");

  const { items } = await listPostings({ q: keyword, status: "all", limit: 50 });
  const apps = new Map((await db.select().from(schema.applications)).map((a) => [a.id, a]));
  const line = (p: (typeof items)[number]) =>
    `[${p.status}] ${p.company} | ${p.title} | 마감=${p.deadline ?? "수시"} | 지원여부=${JSON.stringify(p.decision)}` +
    (apps.get(p.id) ? ` | 단계=${apps.get(p.id)!.stage}` : "");

  if (action === "find") {
    console.log(items.length ? items.map(line).join("\n") : "찾은 공고가 없어요.");
    return;
  }

  const hits = values.pick ? items.filter((p) => p.title === values.pick) : items;
  if (hits.length !== 1) {
    console.log(hits.length ? `후보 ${hits.length}건 — --pick "공고명"으로 하나를 정해 다시 실행:\n${hits.map(line).join("\n")}` : "찾은 공고가 없어요. 새 공고면 공고 수집으로 먼저 추가하세요.");
    process.exit(hits.length ? 0 : 1);
  }
  const p = hits[0];
  const done = (r: { ok: boolean; error?: string }, msg: string) => {
    if (!r.ok) { console.error(`실패: ${r.error}`); process.exit(1); }
    console.log(msg);
  };

  if (action === "plan" || action === "unplan" || action === "skip" || action === "unskip") {
    if (p.decision === "지원완료") { console.error(`이미 지원완료예요. 되돌리려면 확인이 필요해요: ${p.company} | ${p.title}`); process.exit(1); }
    const decision = { plan: "예정", skip: "x", unplan: "", unskip: "" }[action] as "예정" | "x" | "";
    const label = { plan: "지원 예정", skip: "지원 안 함", unplan: "예정 해제", unskip: "표시 해제" }[action];
    done(await actions.updatePosting(p.id, { decision }), `${label}: ${p.company} | ${p.title} (마감 ${p.deadline ?? "수시"})`);
  } else if (action === "apply") {
    done(await actions.markSubmitted(p.id, values.date), `지원완료: ${p.company} | ${p.title}`);
  } else if (action === "step") {
    const app = apps.get(p.id);
    if (!app) { console.error(`지원현황에 없어요. 먼저 apply 하세요: ${p.company}`); process.exit(1); }
    const stage = values.stage ?? app.stage;
    const stages = (await loadSourceMeta(db)).전형단계 ?? [];
    if (values.stage && stages.length && !stages.includes(values.stage)) {
      console.error(`없는 전형 단계예요: ${values.stage}\n가능한 값: ${stages.join(" / ")}`);
      process.exit(1);
    }
    const ended = ["최종 합격", "불합격", "불참·포기"].includes(stage);
    const { kind, label } = eventKindFor(stage);
    const nextEvent = values.date && !ended
      ? { kind, title: `${p.company} ${label}`, date: values.date, time: values.time ?? null }
      : undefined;
    done(await actions.setStage(app.id, stage, nextEvent), `${p.company}: 단계=${stage}${nextEvent ? ` · 다음 일정 ${values.date}${values.time ? ` ${values.time}` : ""}` : ""}`);
  }

  const { justdoConfigured, syncJustdo } = await import("../src/lib/justdo/sync");
  if (justdoConfigured()) {
    const r = await syncJustdo().catch((e: Error) => ({ error: e.message }));
    console.log("justdo:", JSON.stringify(r));
  }
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
