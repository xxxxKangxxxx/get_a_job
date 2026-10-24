// 임시 가짜 데이터. 백엔드가 실제 구현으로 바꾸면 이 파일은 지운다.
// 오늘 = 2026-10-24(토) 기준.
import type {
  PostingSummary, TodayView, ScheduleView, InboxView, BoardView, DayLoad, Warning, EventItem, AppSettings,
} from "@/contracts/types";

const p = (o: Partial<PostingSummary> & Pick<PostingSummary, "id" | "company" | "title">): PostingSummary => ({
  jobCategory: "", companyType: "대기업", employmentType: "신입 정규직", location: "", openDate: null,
  deadline: null, deadlineTime: null, rolling: false, dday: null, fit: "A", decision: "", status: "진행중",
  source: "자소설닷컴", url: "", notes: "", estHours: null, progress: 0, origin: "collected", ...o,
});

export const POSTINGS: PostingSummary[] = [
  p({ id: "동국제약|구매팀 채용 ~ 10/28", company: "동국제약", title: "구매팀 채용", jobCategory: "구매", companyType: "중견기업", location: "서울", deadline: "2026-10-28", dday: 4, decision: "예정", estHours: 4, progress: 0 }),
  p({ id: "LS MnM|신입사원 수시채용 (자금)", company: "LS MnM", title: "신입사원 수시채용 (자금)", jobCategory: "재무·자금", location: "울산", deadline: "2026-11-03", dday: 10, decision: "예정", estHours: 5, progress: 30, fit: "B" }),
  p({ id: "한국타이어|SCM 신입", company: "한국타이어", title: "2026 하반기 신입 SCM", jobCategory: "SCM·물류", location: "대전", deadline: "2026-10-31", dday: 7, decision: "예정", estHours: 6, progress: 10 }),
  p({ id: "효성|영업관리", company: "효성", title: "영업관리 신입", jobCategory: "영업관리", location: "서울", deadline: "2026-10-31", dday: 7, decision: "예정", estHours: 4, fit: "C" }),
  p({ id: "LS MnM|신입사원 수시채용 (구매·자재)", company: "LS MnM", title: "신입사원 수시채용 (구매·자재)", jobCategory: "구매·자재", location: "울산", deadline: "2026-11-05", dday: 12 }),
  p({ id: "HD현대일렉트릭|생산관리", company: "HD현대일렉트릭", title: "생산관리 신입", jobCategory: "생산관리", location: "울산", deadline: "2026-10-30", dday: 6, source: "사람인" }),
  p({ id: "CJ제일제당|SCM", company: "CJ제일제당", title: "SCM 신입", jobCategory: "SCM·물류", location: "서울", deadline: "2026-11-02", dday: 9, fit: "B", source: "링커리어" }),
];

const ev = (id: number, o: Partial<EventItem> & Pick<EventItem, "kind" | "title" | "date">): EventItem =>
  ({ id, time: null, postingId: null, applicationId: null, done: false, ...o });

export const EVENTS: EventItem[] = [
  ev(1, { kind: "면접", title: "현대무벡스 1차면접", date: "2026-10-29", time: "14:00", applicationId: "현대무벡스|물류기획" }),
];

const day = (date: string, o: Partial<DayLoad>): DayLoad => ({
  date, baseHours: 3, busyHours: 0, capacity: 3, used: 0, blocks: [], deadlines: [], events: [], busy: [], overloaded: false, ...o,
});

export const WEEK: DayLoad[] = [
  day("2026-10-24", { baseHours: 6, busyHours: 2, capacity: 4, used: 4, busy: [{ title: "약속", start: "14:00", end: "16:00" }], blocks: [
    { itemId: "a:동국제약", kind: "application", company: "동국제약", label: "구매팀", hours: 2, finishes: false },
    { itemId: "a:LS자금", kind: "application", company: "LS MnM", label: "자금", hours: 1.5, finishes: false },
    { itemId: "p:무벡스", kind: "prep", company: "현대무벡스", label: "1차면접 준비", hours: 0.5, finishes: false },
  ] }),
  day("2026-10-25", { baseHours: 6, capacity: 6, used: 6, overloaded: true, blocks: [
    { itemId: "a:동국제약", kind: "application", company: "동국제약", label: "구매팀", hours: 2, finishes: true },
    { itemId: "a:한국타이어", kind: "application", company: "한국타이어", label: "SCM", hours: 4, finishes: false },
  ] }),
  day("2026-10-26", { capacity: 3, used: 3, overloaded: true, blocks: [
    { itemId: "a:한국타이어", kind: "application", company: "한국타이어", label: "SCM", hours: 1.5, finishes: true },
    { itemId: "a:효성", kind: "application", company: "효성", label: "영업관리", hours: 1.5, finishes: false },
  ] }),
  day("2026-10-27", { capacity: 3, used: 3, blocks: [
    { itemId: "a:효성", kind: "application", company: "효성", label: "영업관리", hours: 1.5, finishes: false },
    { itemId: "p:무벡스", kind: "prep", company: "현대무벡스", label: "1차면접 준비", hours: 1.5, finishes: false },
  ] }),
  day("2026-10-28", { capacity: 3, used: 3, overloaded: true, deadlines: [{ postingId: POSTINGS[0].id, company: "동국제약", label: "구매팀", fit: "A" }], blocks: [
    { itemId: "p:무벡스", kind: "prep", company: "현대무벡스", label: "1차면접 준비", hours: 2, finishes: true },
    { itemId: "a:효성", kind: "application", company: "효성", label: "영업관리", hours: 1, finishes: false },
  ] }),
  day("2026-10-29", { capacity: 2, busyHours: 1, used: 2, events: [EVENTS[0]], blocks: [
    { itemId: "a:LS자금", kind: "application", company: "LS MnM", label: "자금", hours: 2, finishes: false },
  ] }),
  day("2026-10-30", { capacity: 3, used: 0, deadlines: [] }),
];

export const WARNINGS: Warning[] = [{
  id: "overload:2026-10-31", kind: "overload", date: "2026-10-31",
  title: "10/31(토) 마감 2건이 몰려 있어요",
  message: "10시간이 필요한데 그 전까지 8시간만 쓸 수 있어요",
  neededHours: 10, availableHours: 8,
  atRisk: [{ postingId: "효성|영업관리", company: "효성", label: "영업관리", fit: "C" }],
  fixes: [
    { id: "drop:효성|영업관리", kind: "drop", label: "효성 영업관리(C) 포기하기", detail: "한국타이어 SCM(A)은 제때 끝나요", postingId: "효성|영업관리" },
    { id: "addHours:2026-10-25:3", kind: "addHours", label: "일요일 3시간 더 쓰기", detail: "2건 모두 끝나요 · 일요일 9시간", date: "2026-10-25", hours: 3 },
  ],
}];

export const TODAY: TodayView = {
  date: "2026-10-24", baseHours: 6, busyHours: 2, availableHours: 4,
  tasks: [
    { id: "2026-10-24:a:동국제약", kind: "application", postingId: POSTINGS[0].id, applicationId: null, company: "동국제약", label: "구매팀", hours: 2, progressFrom: 0, progressTo: 50, dueDate: "2026-10-28", dueTime: null, dday: 4, fit: "A", done: false },
    { id: "2026-10-24:a:LS자금", kind: "application", postingId: POSTINGS[1].id, applicationId: null, company: "LS MnM", label: "자금", hours: 1.5, progressFrom: 30, progressTo: 60, dueDate: "2026-11-03", dueTime: null, dday: 10, fit: "B", done: false },
    { id: "2026-10-24:p:무벡스", kind: "prep", postingId: null, applicationId: "현대무벡스|물류기획", company: "현대무벡스", label: "1차면접 준비", hours: 0.5, progressFrom: null, progressTo: null, dueDate: "2026-10-29", dueTime: "14:00", dday: 5, fit: "A", done: false },
  ],
  warnings: WARNINGS,
  week: WEEK,
  counts: { inbox: 12, needDecision: 3 },
  calendar: { connected: true, lastSyncAt: "2026-10-24T09:12:00+09:00" },
};

export const SCHEDULE: ScheduleView = { today: "2026-10-24", days: WEEK, warnings: WARNINGS, calendar: TODAY.calendar };

export const INBOX: InboxView = {
  cards: POSTINGS.filter((x) => x.decision === "").map((x, i) => ({
    ...x,
    reason: i === 0 ? "needDecision" as const : "new" as const,
    impact: i % 2 === 0
      ? { estHours: 4, fits: true, days: ["2026-11-02", "2026-11-03", "2026-11-04"], message: "11/2~11/4에 나눠 쓰면 다른 공고와 겹치지 않아요" }
      : { estHours: 4, fits: false, days: ["2026-10-29", "2026-10-30"], message: "지원하면 10/31 마감 공고 1건을 놓칠 수 있어요" },
  })),
  counts: { new: 9, needDecision: 3, autoHidden: 27 },
};

export const BOARD: BoardView = {
  columns: [
    { key: "준비 중", cards: POSTINGS.filter((x) => x.decision === "예정").map((x) => ({
      id: x.id, postingId: x.id, company: x.company, title: x.title, jobCategory: x.jobCategory, appliedAt: null,
      stage: "준비 중", column: "준비 중" as const, nextEvent: null, progress: x.progress, deadline: x.deadline, historyNote: "", url: x.url })) },
    { key: "서류", cards: [{ id: "기아|생산관리", postingId: null, company: "기아", title: "2026 하반기 신입 생산관리", jobCategory: "생산관리", appliedAt: "2026-10-20", stage: "서류 결과 대기", column: "서류", nextEvent: null, progress: null, deadline: "2026-10-20", historyNote: "", url: "" }] },
    { key: "인적성", cards: [{ id: "SK하이닉스|양산관리", postingId: null, company: "SK하이닉스", title: "양산관리·양산기술", jobCategory: "양산관리·양산기술", appliedAt: "2026-09-05", stage: "서류 합격 · 인적성 대기", column: "인적성", nextEvent: null, progress: null, deadline: null, historyNote: "서류 합격 · SKCT 심층 9/12 응시", url: "" }] },
    { key: "1차면접", cards: [{ id: "현대무벡스|물류기획", postingId: null, company: "현대무벡스", title: "물류기획 신입", jobCategory: "물류", appliedAt: "2026-10-01", stage: "서류 합격 · 1차면접 대기", column: "1차면접", nextEvent: EVENTS[0], progress: null, deadline: null, historyNote: "", url: "" }] },
    { key: "2차면접", cards: [] },
    { key: "최종", cards: [{ id: "서울시 미래청년일자리|AI", postingId: null, company: "서울시 미래청년일자리", title: "AI·데이터", jobCategory: "AI·데이터", appliedAt: "2026-08-12", stage: "최종 합격", column: "최종", nextEvent: null, progress: null, deadline: null, historyNote: "서류 8/21 합격 · 인적성 8/24 · 1차면접 8/27 · 최종 9/3", url: "" }] },
    { key: "탈락", cards: [] },
  ],
  totals: { applied: 25, active: 3, finalPass: 1 },
  stages: ["서류 결과 대기", "서류 합격 · 다음 전형 대기", "서류 합격 · 인적성 대기", "서류 합격 · 1차면접 대기", "인적성 완료 · 결과 대기", "인적성 합격 · 1차면접 대기", "1차면접 완료 · 결과 대기", "1차면접 합격 · 2차면접 대기", "1차면접 합격 · 최종 대기", "2차면접 완료 · 결과 대기", "2차면접 합격 · 최종 대기", "최종 합격", "불참·포기", "불합격"],
};

export const SETTINGS: AppSettings = {
  weekdayHours: 3, weekendHours: 6, bufferDays: 1, defaultEstHours: 4, overrides: {},
  workWindow: { weekday: { start: "19:00", end: "23:00" }, weekend: { start: "10:00", end: "18:00" } },
  morningBriefTime: "08:00",
};
