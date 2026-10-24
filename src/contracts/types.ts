// 화면(프론트엔드)과 서버(백엔드)가 주고받는 데이터 모양.
// 이 파일은 총괄 세션이 관리한다. 바꿔야 하면 총괄에게 요청한다.
// 날짜는 모두 한국 시간 "YYYY-MM-DD", 시각은 "HH:MM" 문자열.

export type Fit = "A" | "B" | "C" | "";
/** '' 미정 · 예정 지원하기로 함 · 보류 나중에 다시 보기 · x 관심 없음 · 지원완료 제출함 */
export type Decision = "" | "예정" | "보류" | "x" | "지원완료";

export type PostingSummary = {
  id: string;
  company: string;
  title: string;
  jobCategory: string;
  companyType: string; // 대기업 | 중견기업 | 외국계 | 기타기업 | 공공기관 | ''
  employmentType: string; // 신입 정규직 | 채용연계형 인턴 | ...
  location: string;
  openDate: string | null;
  deadline: string | null; // null = 수시 또는 미정
  deadlineTime: string | null;
  rolling: boolean; // 수시 채용
  /** 오늘 기준 남은 일수 (마감 당일 0, 지났으면 음수, 마감 없으면 null) */
  dday: number | null;
  fit: Fit;
  decision: Decision;
  status: "진행중" | "마감";
  source: string;
  url: string;
  notes: string;
  /** 지원서 준비 예상 시간 (모르면 null → 설정의 기본값 사용) */
  estHours: number | null;
  /** 지원서 진행률 0~100 */
  progress: number;
  origin: "collected" | "manual";
};

export type EventKind = "서류발표" | "인적성" | "면접" | "설명회" | "마감" | "기타";

export type EventItem = {
  id: number;
  kind: EventKind;
  title: string;
  date: string;
  time: string | null;
  postingId: string | null;
  applicationId: string | null;
  done: boolean;
};

// ---------- 오늘 ----------

export type TodayTask = {
  /** 계획 항목 id (체크할 때 그대로 돌려준다) */
  id: string;
  kind: "application" | "prep";
  postingId: string | null;
  applicationId: string | null;
  company: string;
  /** 예: "구매팀", "1차면접 준비" */
  label: string;
  hours: number;
  /** 지원서 작업일 때: 오늘 시작 진행률 → 오늘 끝낼 진행률 */
  progressFrom: number | null;
  progressTo: number | null;
  /** 지원서 마감일 또는 전형 일정일 */
  dueDate: string | null;
  dueTime: string | null;
  dday: number | null;
  fit: Fit;
  done: boolean;
};

export type CalendarStatus = {
  connected: boolean;
  lastSyncAt: string | null; // ISO
};

export type Fix = {
  id: string;
  kind: "drop" | "addHours";
  /** 예: "효성 영업관리(C) 포기하기" */
  label: string;
  /** 예: "나머지 A·B 2건은 제때 끝나요" */
  detail: string;
  postingId?: string;
  date?: string;
  hours?: number;
};

export type Warning = {
  id: string;
  kind: "overload";
  /** 몰린 마감일 */
  date: string;
  /** 예: "10/31(금) 마감 3건이 몰려 있어요" */
  title: string;
  /** 예: "12시간이 필요한데 그 전까지 9시간만 쓸 수 있어요" */
  message: string;
  neededHours: number;
  availableHours: number;
  atRisk: { postingId: string; company: string; label: string; fit: Fit }[];
  fixes: Fix[];
};

export type DayBlock = {
  itemId: string;
  kind: "application" | "prep";
  company: string;
  label: string;
  hours: number;
  /** 이 날로 지원서가 완성되면 true */
  finishes: boolean;
};

export type DayLoad = {
  date: string;
  /** 설정상 기본 가용 시간 */
  baseHours: number;
  /** 캘린더 개인 일정으로 빠진 시간 */
  busyHours: number;
  /** 실제 쓸 수 있는 시간 = baseHours - busyHours (예외 설정 반영) */
  capacity: number;
  used: number;
  blocks: DayBlock[];
  /** 이 날 마감인 "예정" 공고 */
  deadlines: { postingId: string; company: string; label: string; fit: Fit }[];
  /** 이 날의 전형 일정 */
  events: EventItem[];
  /** 캘린더 개인 일정 (제목은 표시용) */
  busy: { title: string; start: string | null; end: string | null }[];
  overloaded: boolean;
};

export type TodayView = {
  date: string;
  baseHours: number;
  busyHours: number;
  availableHours: number;
  tasks: TodayTask[];
  warnings: Warning[];
  /** 오늘 포함 7일 */
  week: DayLoad[];
  counts: { inbox: number; needDecision: number };
  calendar: CalendarStatus;
};

// ---------- 일정 ----------

export type ScheduleView = {
  today: string;
  days: DayLoad[];
  warnings: Warning[];
  calendar: CalendarStatus;
};

// ---------- 받은편지함 ----------

export type InboxImpact = {
  estHours: number;
  /** 지원해도 다른 공고를 놓치지 않으면 true */
  fits: boolean;
  /** 작업이 배치될 날짜들 */
  days: string[];
  /** 예: "11/2~11/4에 나눠 쓰면 다른 공고와 겹치지 않아요" */
  message: string;
};

export type InboxCard = PostingSummary & {
  /** new 새 공고 · needDecision 적합도 A인데 아직 미정이고 마감이 가까움 */
  reason: "new" | "needDecision";
  impact: InboxImpact;
};

export type InboxView = {
  cards: InboxCard[];
  counts: { new: number; needDecision: number; autoHidden: number };
};

export type DismissReasonKind = "jobCategory" | "location" | "employmentType" | "companyType" | "company" | "other";
export type DismissReason = { kind: DismissReasonKind; value: string };

export type HideRule = { id: number; kind: DismissReasonKind; value: string; hiddenCount: number; createdAt: string };

// ---------- 지원 현황 ----------

export type BoardColumnKey = "준비 중" | "서류" | "인적성" | "1차면접" | "2차면접" | "최종" | "탈락";

export type ApplicationCard = {
  id: string;
  postingId: string | null;
  company: string;
  title: string;
  jobCategory: string;
  appliedAt: string | null;
  /** meta.전형단계 값 (예: "서류 결과 대기"), 준비 중이면 "준비 중" */
  stage: string;
  column: BoardColumnKey;
  nextEvent: EventItem | null;
  /** 준비 중일 때 진행률 */
  progress: number | null;
  deadline: string | null;
  historyNote: string;
  url: string;
};

export type BoardView = {
  columns: { key: BoardColumnKey; cards: ApplicationCard[] }[];
  totals: { applied: number; active: number; finalPass: number };
  /** 고를 수 있는 전형단계 목록 (meta.전형단계) */
  stages: string[];
};

// ---------- 공고 ----------

export type PostingFilter = {
  q?: string;
  fit?: Fit[];
  status?: "진행중" | "마감" | "all";
  decision?: Decision[];
  companyType?: string[];
  employmentType?: string[];
  sort?: "deadline" | "fit" | "recent";
  limit?: number;
  offset?: number;
};

export type PostingDetail = PostingSummary & {
  companyTypeBasis: string | null;
  surveyedAt: string | null;
  events: EventItem[];
  application: ApplicationCard | null;
};

export type PostingPatch = Partial<Pick<PostingSummary,
  "decision" | "fit" | "notes" | "estHours" | "progress" | "deadline" | "deadlineTime">>;

export type NewPostingInput = {
  company: string;
  title: string;
  jobCategory?: string;
  companyType?: string;
  employmentType?: string;
  location?: string;
  openDate?: string | null;
  deadline?: string | null;
  deadlineTime?: string | null;
  url?: string;
  notes?: string;
  fit?: Fit;
  estHours?: number | null;
};

export type NewEventInput = {
  kind: EventKind;
  title: string;
  date: string;
  time?: string | null;
  postingId?: string | null;
  applicationId?: string | null;
  notes?: string;
};

// ---------- 설정 ----------

export type AppSettings = {
  weekdayHours: number;
  weekendHours: number;
  bufferDays: number;
  defaultEstHours: number;
  /** 날짜별 가용 시간 예외 */
  overrides: Record<string, number>;
  /** 작업 블록을 캘린더에 놓을 시간대 */
  workWindow: { weekday: { start: string; end: string }; weekend: { start: string; end: string } };
  morningBriefTime: string; // "08:00"
};

export type ActionResult = { ok: true } | { ok: false; error: string };
