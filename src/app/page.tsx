// 임시 홈 = 새 공고(받은편지함). 공고를 보고 지원할지 고르는 기능만 있다 (D26). 디자인 확정 후 바꾼다.
import { Suspense } from "react";
import { connection } from "next/server";
import { getInbox, listPostings } from "@/server/queries";
import { justdoConfigured } from "@/lib/justdo/sync";
import { Inbox } from "./_inbox/inbox";

async function InboxData() {
  await connection(); // 요청마다 DB에서 새로 읽는다
  const [inbox, planned] = await Promise.all([
    getInbox(),
    listPostings({ decision: ["예정"], status: "all", limit: 200 }),
  ]);
  return <Inbox cards={inbox.cards} planned={planned.items} justdo={justdoConfigured()} />;
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-28 pt-6">
      <Suspense fallback={<p className="py-10 text-center text-[15px] text-muted">불러오는 중…</p>}>
        <InboxData />
      </Suspense>
    </main>
  );
}
