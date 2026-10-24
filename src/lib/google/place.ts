// 캘린더에 쓸 내용 계산 (순수 함수, 외부 호출 없음 → 테스트 가능).
// - FreeBusy 구간 → 한국 날짜별 바쁜 시간 행
// - 작업 블록 → 작업 시간대(workWindow) 안에서 바쁜 시간을 피해 실제 시각 배치
// - 접수 기간·전형 일정·작업 블록 → 구글 이벤트 본문
import type { AppSettings, DayLoad, PostingSummary } from "../../contracts/types";
import { addDays, weekday } from "../date";
import { TIME_ZONE } from "./config";
import type { GEventBody } from "./calendar";

const KST_MS = 9 * 3600_000;

/** start/end = null 이면 종일 */
export type BusyRow = { date: string; start: string | null; end: string | null; title: string; source: "google" };

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** ISO 시각 → 한국 기준 [날짜, 자정부터 분] */
function kst(iso: string): [string, number] {
  const d = new Date(new Date(iso).getTime() + KST_MS).toISOString();
  return [d.slice(0, 10), Number(d.slice(11, 13)) * 60 + Number(d.slice(14, 16))];
}

/** FreeBusy 구간을 한국 날짜별로 자른다. 자정을 넘기면 나눈다 (끝이 자정이면 "24:00"). */
export function splitBusy(intervals: { start: string; end: string }[], title = "개인 일정"): BusyRow[] {
  const out: BusyRow[] = [];
  for (const iv of intervals) {
    let [d, s] = kst(iv.start);
    const [ed, e] = kst(iv.end);
    while (d < ed) {
      if (s === 0) out.push({ date: d, start: null, end: null, title, source: "google" });
      else if (s < 1440) out.push({ date: d, start: toHHMM(s), end: "24:00", title, source: "google" });
      d = addDays(d, 1);
      s = 0;
    }
    if (e > s) out.push({ date: d, start: toHHMM(s), end: toHHMM(e), title, source: "google" });
  }
  return out;
}

export type PlacedBlock = { itemId: string; company: string; label: string; kind: "application" | "prep"; start: string; end: string; part: number };

/**
 * 하루의 작업 블록을 실제 시각에 놓는다.
 * 작업 시간대 안에서 바쁜 시간을 뺀 빈 구간에 15분 단위로 차례로 채우고,
 * 한 구간에 안 들어가면 다음 빈 구간으로 나눠 놓는다. 시간대를 넘치면 시간대 끝 뒤(자정 전까지)에 이어 놓는다.
 */
export function placeDay(day: Pick<DayLoad, "date" | "blocks" | "busy">, window: AppSettings["workWindow"]): PlacedBlock[] {
  const w = weekday(day.date) === 0 || weekday(day.date) === 6 ? window.weekend : window.weekday;
  const busy = day.busy
    // 시각이 없으면 종일 바쁨
    .map((b) => [b.start ? toMin(b.start) : 0, b.end ? toMin(b.end) : 1440] as const)
    .sort((a, b) => a[0] - b[0]);
  // 빈 구간 = [시간대] - 바쁜 시간, 그 뒤 [시간대 끝, 24:00] - 바쁜 시간 (넘칠 때만 씀)
  const free = (from: number, to: number) => {
    const res: [number, number][] = [];
    let cur = from;
    for (const [bs, be] of busy) {
      if (be <= cur || bs >= to) continue;
      if (bs > cur) res.push([cur, bs]);
      cur = Math.max(cur, be);
    }
    if (cur < to) res.push([cur, to]);
    return res;
  };
  const ws = toMin(w.start), we = toMin(w.end);
  const slots = [...free(ws, we), ...free(we, 1440)];

  const out: PlacedBlock[] = [];
  let si = 0;
  let cursor = slots[0]?.[0] ?? 0;
  for (const b of day.blocks) {
    let left = Math.round((b.hours * 60) / 15) * 15;
    let part = 0;
    while (left > 0 && si < slots.length) {
      const [, se] = slots[si];
      if (cursor >= se) { si++; cursor = slots[si]?.[0] ?? 0; continue; }
      const take = Math.min(left, se - cursor);
      out.push({ itemId: b.itemId, company: b.company, label: b.label, kind: b.kind, start: toHHMM(cursor), end: toHHMM(cursor + take), part: part++ });
      cursor += take;
      left -= take;
    }
  }
  return out;
}

export type Desired = { key: string; date: string; body: GEventBody };

const priv = (key: string) => ({ private: { gajKey: key } });
const timed = (date: string, hhmm: string) => ({ dateTime: `${date}T${hhmm === "24:00" ? "23:59" : hhmm}:00+09:00`, timeZone: TIME_ZONE });

/**
 * 캘린더에 있어야 할 이벤트 전체 (D10).
 * - 접수 기간: "예정"이고 진행중이며 마감이 오늘 이후인 공고 → 접수 시작~마감 종일 일정
 *   (지원완료 후에는 전형 일정만 남는다. 미결정·보류·관심없음 공고는 넣지 않는다)
 * - 전형 일정: 끝나지 않은 서류발표·인적성·면접 등 (마감 종류는 접수 기간과 겹쳐서 뺀다)
 * - 작업 블록: 시간대 배치
 */
export function buildDesired(input: {
  today: string;
  days: DayLoad[];
  postings: PostingSummary[];
  workWindow: AppSettings["workWindow"];
  appUrl?: string;
}): Desired[] {
  const out: Desired[] = [];
  const link = (path: string) => (input.appUrl ? `\n\n${input.appUrl}${path}` : "");

  for (const p of input.postings) {
    if (p.decision !== "예정" || p.status !== "진행중" || !p.deadline || p.deadline < input.today) continue;
    const key = `period:${p.id}`;
    const start = p.openDate && p.openDate <= p.deadline ? p.openDate : p.deadline;
    out.push({
      key, date: p.deadline,
      body: {
        summary: `📮 ${p.company} 접수${p.deadlineTime ? ` (~${p.deadlineTime})` : ""}`,
        description: `${p.title}${p.fit ? ` · 적합도 ${p.fit}` : ""}${p.url ? `\n${p.url}` : ""}${link(`/postings/${encodeURIComponent(p.id)}`)}`,
        start: { date: start },
        end: { date: addDays(p.deadline, 1) },
        transparency: "transparent",
        colorId: "5",
        extendedProperties: priv(key),
      },
    });
  }

  for (const d of input.days) {
    for (const e of d.events) {
      if (e.done || e.kind === "마감") continue;
      const key = `event:${e.id}`;
      const body: GEventBody = e.time
        ? { summary: `📌 ${e.title}`, start: timed(e.date, e.time), end: timed(e.date, toHHMM(Math.min(toMin(e.time) + 60, 1439))) }
        : { summary: `📌 ${e.title}`, start: { date: e.date }, end: { date: addDays(e.date, 1) }, transparency: "transparent" };
      out.push({ key, date: e.date, body: { ...body, description: `${e.kind}${link("/schedule")}`, colorId: "11", extendedProperties: priv(key) } });
    }
    if (d.date < input.today) continue;
    for (const b of placeDay(d, input.workWindow)) {
      const key = `block:${d.date}:${b.itemId}:${b.part}`;
      out.push({
        key, date: d.date,
        body: {
          summary: `${b.kind === "prep" ? "🧠" : "✍️"} ${b.company} ${b.label}`,
          description: `오늘 할 일${link("/")}`,
          start: timed(d.date, b.start),
          end: timed(d.date, b.end),
          colorId: b.kind === "prep" ? "3" : "9",
          reminders: { useDefault: false },
          extendedProperties: priv(key),
        },
      });
    }
  }
  return out;
}
