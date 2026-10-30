// 공고 수집으로 찾은 새 공고를 원본 JSON(data/postings.json)에 합친다.  사용법: pnpm postings:add <새공고.json> [회차]
//
// <새공고.json>은 배열. 기업명·공고명·적합도는 필수, 나머지는 모르면 빼거나 빈 값으로 둔다(추정값 금지).
//   [{ "기업명": "포스코", "기업형태": "대기업", "기업형태근거": "[집단] 포스코그룹",
//      "공고명": "2026년 하반기 신입사원 채용", "직무분류": "구매·생산기술", "근무지": "경북 포항",
//      "고용형태": "신입 정규직", "접수시작": "2026-09-01", "접수마감": "2026-09-16", "적합도": "A",
//      "비고": "모집직무 중 해당: 구매", "출처": "자소설닷컴, 사람인", "링크": "https://..." }]
// 이미 있는 공고의 빈 근무지만 채우려면: { "_근무지보강": true, "기업명": "...", "공고명": "...", "근무지": "서울 종로" }
//
// 하는 일: 1) 마감일이 지난 공고를 '마감'으로 2) 기업명+공고명이 이미 있으면 건너뜀 3) 값 검증
//          4) 하나라도 틀리면 아무것도 저장하지 않고 오류를 모두 보여 준다. 저장 전에 .bak 백업.
// 그다음 `pnpm sync`로 DB에 넣는다.
import "./env";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { postingsJsonPath } from "./paths";
import { todayKST } from "../src/lib/date";

export const FIELDS = ["기업명", "기업형태", "기업형태근거", "공고명", "직무분류", "근무지", "고용형태", "접수시작", "접수마감", "적합도", "비고", "출처", "링크"] as const;
const FIT = new Set(["A", "B", "C"]);
const BIZ = new Set(["대기업", "중견기업", "외국계", "기타기업", ""]);

type Row = Record<string, string | null>;
export type Data = { meta: Record<string, unknown>; 공고: Row[]; 지원현황: unknown[] };

const validDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

export function mergePostings(data: Data, items: Row[], today: string) {
  const errs: string[] = [], added: string[] = [], skipped: string[] = [], filled: string[] = [], archived: string[] = [];
  const isClosed = (d: string | null) => !!d && d !== "수시" && d < today;
  const date = (v: unknown, where: string) => {
    if (v === undefined || v === null || v === "" || v === "수시") return (v as string) || null;
    if (typeof v === "string" && validDate(v)) return v;
    errs.push(`${where}: 날짜 형식이 아님 — ${JSON.stringify(v)} (YYYY-MM-DD 또는 "수시")`);
    return null;
  };

  for (const r of data.공고) {
    const want = isClosed(r.접수마감) ? "마감" : "진행중";
    if (r.상태 !== want && want === "마감") archived.push(`${r.기업명} | ${String(r.공고명).slice(0, 34)}`);
    r.상태 = want;
  }

  const key = (co: string, title: string) => `${co}\u0000${title}`;
  const existing = new Map(data.공고.map((r) => [key(String(r.기업명), String(r.공고명)), r]));

  items.forEach((it, i) => {
    const co = String(it.기업명 ?? "").trim(), title = String(it.공고명 ?? "").trim();
    if (!co || !title) { errs.push(`${i + 1}번째 항목: 기업명·공고명은 필수`); return; }
    const where = `${co} | ${title.slice(0, 24)}`;

    if (it._근무지보강) {
      const tgt = existing.get(key(co, title));
      if (!tgt) errs.push(`${where}: 근무지 보강 대상을 못 찾음`);
      else if (tgt.근무지) skipped.push(`${where} — 근무지가 이미 있어 건너뜀`);
      else { tgt.근무지 = String(it.근무지 ?? ""); filled.push(`${where} -> ${tgt.근무지}`); }
      return;
    }
    if (existing.has(key(co, title))) { skipped.push(`${where} — 이미 등록됨`); return; }

    const fit = String(it.적합도 ?? "");
    if (!FIT.has(fit)) errs.push(`${where}: 적합도는 A/B/C 중 하나여야 함 (받은 값 ${JSON.stringify(fit)})`);
    const biz = String(it.기업형태 ?? "");
    if (!BIZ.has(biz)) errs.push(`${where}: 기업형태 허용값 아님 ${JSON.stringify(biz)} — ${[...BIZ].join(", ")}`);
    const start = date(it.접수시작, `${where} 접수시작`);
    const end = date(it.접수마감, `${where} 접수마감`);

    const row: Row = { id: `${co}|${title}`, 조사일: today };
    for (const f of FIELDS) row[f] = it[f] ? String(it[f]) : "";
    row.기업명 = co;
    row.공고명 = title;
    row.접수시작 = start;
    row.접수마감 = end;
    row.지원여부 = "";
    row.상태 = isClosed(end) ? "마감" : "진행중";
    data.공고.push(row);
    existing.set(key(co, title), row);
    added.push(`[${fit}] ${co} | ${title.slice(0, 38)} · 마감 ${end ?? "수시"}`);
  });

  return { errs, added, skipped, filled, archived };
}

function main() {
  const [file, round] = process.argv.slice(2);
  if (!file) { console.error("사용법: pnpm postings:add <새공고.json> [회차]"); process.exit(1); }
  const path = postingsJsonPath();
  const data = JSON.parse(readFileSync(path, "utf-8")) as Data;
  const items = JSON.parse(readFileSync(file, "utf-8")) as Row[];
  if (!Array.isArray(items)) { console.error("새 공고 파일은 배열이어야 한다"); process.exit(1); }

  const today = todayKST();
  const r = mergePostings(data, items, today);
  if (r.errs.length) {
    console.log("!! 저장하지 않음 — 아래를 고친 뒤 다시 실행한다");
    for (const e of r.errs) console.log("  ", e);
    process.exit(1);
  }
  copyFileSync(path, `${path}.bak`);
  data.meta.최종조사일 = today;
  data.meta.생성일 ??= today;
  if (round) data.meta.회차 = Number(round);
  writeFileSync(path, JSON.stringify(data, null, 1));

  const live = data.공고.filter((p) => p.상태 === "진행중");
  const byFit: Record<string, number> = {};
  for (const p of live) byFit[String(p.적합도)] = (byFit[String(p.적합도)] ?? 0) + 1;
  console.log(`신규 ${r.added.length}건 · 마감 이관 ${r.archived.length}건 · 근무지 보강 ${r.filled.length}건 · 건너뜀 ${r.skipped.length}건`);
  console.log(`진행중 ${live.length}건 ${JSON.stringify(byFit)}`);
  if (r.added.length) console.log(`-- 신규 --\n${r.added.sort().map((a) => `   ${a}`).join("\n")}`);
  if (r.filled.length) console.log(`-- 근무지 보강 --\n${r.filled.map((a) => `   ${a}`).join("\n")}`);
  console.log("\n다음: pnpm sync 로 DB에 넣는다.");
}

if (process.argv[1]?.endsWith("add-postings.ts")) main();
