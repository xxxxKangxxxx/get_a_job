"use client";
// 새 공고: 공고마다 지원 / 보류 / 관심 없음을 고른다. 고른 공고는 "지원 예정" 탭에 모이고 justdo로 보내진다.
import { useEffect, useState, useTransition } from "react";
import { ChevronDown, ExternalLink, X } from "lucide-react";
import type { DismissReason, InboxCard, PostingSummary } from "@/contracts/types";
import { decideInbox, markSubmitted, undoDecision, updatePosting } from "@/server/actions";
import { ddayLabel, isUrgent, metaLine, periodLabel } from "./format";

type Toast = { key: number; text: string; undo?: () => Promise<{ ok: boolean }> };
type Tab = "inbox" | "planned";

export function Inbox({ cards, planned }: { cards: InboxCard[]; planned: PostingSummary[] }) {
  const [tab, setTab] = useState<Tab>("inbox");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<InboxCard | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  // 목록별로 가린다. 같은 공고가 고르기에서 빠지고 지원 예정에 들어오기 때문 (키 = "목록:id")
  // 서버 목록에서 이미 빠진 공고는 더 가릴 필요가 없다. 그래야 같은 공고가 다시 들어와도 보인다.
  const [seen, setSeen] = useState({ cards, planned });
  if (seen.cards !== cards || seen.planned !== planned) {
    setSeen({ cards, planned });
    const live = new Set([...cards.map((c) => `inbox:${c.id}`), ...planned.map((p) => `planned:${p.id}`)]);
    setHidden((h) => new Set([...h].filter((k) => live.has(k))));
  }
  const hide = (key: string) => setHidden((s) => new Set(s).add(key));
  const show = (key: string) => setHidden((s) => { const n = new Set(s); n.delete(key); return n; });

  /** 화면에서 먼저 빼고 서버에 보낸다. 실패하면 되살린다. */
  function run(key: string, action: () => Promise<{ ok: boolean; error?: string }>, toastText: string, undo?: Toast["undo"]) {
    hide(key);
    setError(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) {
        show(key);
        setError(r.error ?? "저장하지 못했어요. 다시 시도해 주세요.");
        return;
      }
      setToast({ key: Date.now(), text: toastText, undo });
    });
  }

  function undoToast() {
    if (!toast?.undo) return;
    const undo = toast.undo;
    setToast(null);
    startTransition(async () => {
      const r = await undo();
      if (!r.ok) setError("되돌리지 못했어요.");
      setHidden(new Set());
    });
  }

  const decide = (c: InboxCard, d: "예정" | "보류" | "x", reason?: DismissReason) => {
    const label = d === "예정" ? "지원 예정에 넣었어요" : d === "보류" ? "보류했어요" : reason ? "관심 없음 · 비슷한 공고도 숨겨요" : "관심 없음으로 넘겼어요";
    run(`inbox:${c.id}`, () => decideInbox(c.id, d, reason), `${c.company} ${label}`, () => undoDecision(c.id));
  };

  const inbox = cards.filter((c) => !hidden.has(`inbox:${c.id}`));
  const urgent = inbox.filter((c) => c.reason === "needDecision");
  const fresh = inbox.filter((c) => c.reason === "new");
  const plannedList = planned.filter((p) => !hidden.has(`planned:${p.id}`));

  return (
    <>
      <header className="mb-4">
        <h1 className="text-[28px] font-bold leading-[34px] tracking-tight">새 공고</h1>
        <p className="mt-1 text-[14px] text-muted">지원할 공고를 고르면 justdo에 접수 기간이 들어가요.</p>
      </header>

      <div role="tablist" className="mb-4 grid grid-cols-2 rounded-xl bg-line/60 p-1 text-[15px] font-semibold">
        {([["inbox", `새 공고 ${inbox.length}`], ["planned", `지원 예정 ${plannedList.length}`]] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`h-10 rounded-lg ${tab === key ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mb-3 rounded-lg bg-urgent/10 px-3 py-2 text-[14px] text-urgent">{error}</p>}

      {tab === "inbox" ? (
        inbox.length === 0 ? (
          <Empty text="고를 공고가 없어요. 새 공고가 들어오면 여기에 보여요." />
        ) : (
          <>
            {urgent.length > 0 && (
              <Section title="결정이 급해요" note="적합도 A · 마감이 가까워요">
                {urgent.map((c) => (
                  <InboxRow key={c.id} card={c} open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)}
                    onApply={() => decide(c, "예정")} onHold={() => decide(c, "보류")} onDismiss={() => setDismissing(c)} />
                ))}
              </Section>
            )}
            {fresh.length > 0 && (
              <Section title="다른 공고" note="마감 빠른 순">
                {fresh.map((c) => (
                  <InboxRow key={c.id} card={c} open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)}
                    onApply={() => decide(c, "예정")} onHold={() => decide(c, "보류")} onDismiss={() => setDismissing(c)} />
                ))}
              </Section>
            )}
          </>
        )
      ) : plannedList.length === 0 ? (
        <Empty text="아직 지원하기로 한 공고가 없어요." />
      ) : (
        <Section title="지원 예정" note="justdo에 보내는 중">
          {plannedList.map((p) => (
            <PlannedRow key={p.id} posting={p}
              onCancel={() => run(`planned:${p.id}`, () => updatePosting(p.id, { decision: "" }), `${p.company} 지원 예정을 취소했어요`,
                () => updatePosting(p.id, { decision: "예정" }))}
              onSubmitted={() => run(`planned:${p.id}`, () => markSubmitted(p.id), `${p.company} 제출 완료로 옮겼어요`)} />
          ))}
        </Section>
      )}

      {dismissing && (
        <DismissSheet card={dismissing} onClose={() => setDismissing(null)}
          onPick={(reason) => { decide(dismissing, "x", reason); setDismissing(null); }} />
      )}

      {toast && (
        <div key={toast.key} role="status" className="fixed inset-x-0 bottom-4 z-20 mx-auto flex w-[calc(100%-32px)] max-w-xl items-center gap-3 rounded-xl bg-ink px-4 py-3 text-[14px] text-white shadow-lg">
          <span className="flex-1">{toast.text}</span>
          {toast.undo && (
            <button onClick={undoToast} className="-my-2 h-11 px-2 font-semibold text-[#9fd8cf]">되돌리기</button>
          )}
        </div>
      )}
    </>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-[17px] font-bold">{title}</h2>
        <span className="text-[13px] text-muted">{note}</span>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">{children}</ul>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-surface px-4 py-10 text-center text-[15px] text-muted">{text}</p>;
}

function Summary({ p, open, onToggle }: { p: PostingSummary; open: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} aria-expanded={open} className="w-full px-4 pt-4 text-left">
      <div className="flex items-start gap-2">
        <span className="flex-1 text-[16px] font-semibold leading-6">{p.company}</span>
        <span className={`shrink-0 text-[13px] font-semibold leading-6 ${isUrgent(p) ? "text-urgent" : "text-muted"}`}>{ddayLabel(p)}</span>
      </div>
      <p className={`mt-0.5 text-[14px] leading-5 text-ink/80 ${open ? "" : "truncate"}`}>{p.title}</p>
      <p className="mt-1 flex items-center gap-1 text-[13px] leading-[18px] text-muted">
        {p.fit && <span className="font-semibold text-accent">적합도 {p.fit}</span>}
        {p.fit && metaLine(p) && <span aria-hidden>·</span>}
        <span className="truncate">{metaLine(p)}</span>
        <ChevronDown aria-hidden size={16} className={`ml-auto shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </p>
    </button>
  );
}

function Details({ p, extra }: { p: PostingSummary; extra?: React.ReactNode }) {
  return (
    <div className="mx-4 mt-3 space-y-1.5 border-t border-line pt-3 text-[14px] leading-5">
      <p><span className="text-muted">접수 기간</span>&nbsp; {periodLabel(p)}</p>
      {p.companyType && <p><span className="text-muted">기업 형태</span>&nbsp; {p.companyType}</p>}
      {extra}
      {p.url && (
        <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-1 font-semibold text-accent">
          공고 보기 <ExternalLink aria-hidden size={15} />
        </a>
      )}
    </div>
  );
}

function InboxRow({ card, open, onToggle, onApply, onHold, onDismiss }: {
  card: InboxCard; open: boolean; onToggle: () => void; onApply: () => void; onHold: () => void; onDismiss: () => void;
}) {
  const canHold = card.reason === "new";
  return (
    <li className="pb-4">
      <Summary p={card} open={open} onToggle={onToggle} />
      {open && (
        <Details p={card} extra={
          card.impact.message && (
            <p><span className="text-muted">준비 시간</span>&nbsp; {card.impact.estHours}시간 · <span className={card.impact.fits ? "" : "text-urgent"}>{card.impact.message}</span></p>
          )
        } />
      )}
      {/* 결정이 급한 공고는 보류해도 바로 다시 올라오므로 보류를 두지 않는다 */}
      <div className={`mt-3 grid gap-2 px-4 ${canHold ? "grid-cols-[1fr_1fr_1.4fr]" : "grid-cols-[1fr_1.4fr]"}`}>
        <button onClick={onDismiss} className="h-11 rounded-[10px] border border-line text-[15px] font-semibold text-muted">관심 없음</button>
        {canHold && <button onClick={onHold} className="h-11 rounded-[10px] border border-line text-[15px] font-semibold">보류</button>}
        <button onClick={onApply} className="h-11 rounded-[10px] bg-accent text-[15px] font-semibold text-white">지원</button>
      </div>
    </li>
  );
}

function PlannedRow({ posting, onCancel, onSubmitted }: { posting: PostingSummary; onCancel: () => void; onSubmitted: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="pb-4">
      <Summary p={posting} open={open} onToggle={() => setOpen(!open)} />
      {open && <Details p={posting} />}
      <div className="mt-3 grid grid-cols-2 gap-2 px-4">
        <button onClick={onCancel} className="h-11 rounded-[10px] border border-line text-[15px] font-semibold text-muted">지원 취소</button>
        <button onClick={onSubmitted} className="h-11 rounded-[10px] bg-accent-soft text-[15px] font-semibold text-accent">제출 완료</button>
      </div>
    </li>
  );
}

const REASONS: { kind: DismissReason["kind"]; label: string; key: keyof PostingSummary }[] = [
  { kind: "jobCategory", label: "이 직무", key: "jobCategory" },
  { kind: "location", label: "이 지역", key: "location" },
  { kind: "employmentType", label: "이 고용 형태", key: "employmentType" },
  { kind: "companyType", label: "이 기업 형태", key: "companyType" },
  { kind: "company", label: "이 회사", key: "company" },
];

function DismissSheet({ card, onClose, onPick }: { card: InboxCard; onClose: () => void; onPick: (r?: DismissReason) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const options = REASONS.flatMap((r) => {
    const value = String(card[r.key] ?? "").trim();
    return value ? [{ ...r, value }] : [];
  });
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="dismiss-title" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-t-2xl bg-surface px-4 pb-6 pt-4">
        <div className="mb-1 flex items-center">
          <h2 id="dismiss-title" className="flex-1 text-[18px] font-bold">{card.company} 관심 없음</h2>
          <button onClick={onClose} aria-label="닫기" className="-mr-2 grid h-11 w-11 place-items-center text-muted"><X size={20} /></button>
        </div>
        <p className="mb-3 text-[14px] text-muted">이유를 고르면 앞으로 같은 조건의 공고를 자동으로 숨겨요.</p>
        <ul className="divide-y divide-line border-y border-line">
          {options.map((o) => (
            <li key={o.kind}>
              <button onClick={() => onPick({ kind: o.kind, value: o.value })} className="flex min-h-12 w-full items-center gap-3 py-2 text-left text-[15px]">
                <span className="w-24 shrink-0 text-muted">{o.label}</span>
                <span className="font-semibold">{o.value}</span>
                <span className="ml-auto text-[13px] text-muted">숨기기</span>
              </button>
            </li>
          ))}
        </ul>
        <button onClick={() => onPick()} className="mt-4 h-12 w-full rounded-xl bg-ink text-[15px] font-semibold text-white">이유 없이 넘기기</button>
      </div>
    </div>
  );
}
