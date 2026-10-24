// 최소한의 로그인 화면. 디자인은 나중에 총괄/프론트엔드가 입힌다.
import { Suspense } from "react";

export const metadata = { title: "로그인" };

async function LoginForm({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const error = sp.error === "1";
  return (
    <form method="post" action="/api/auth/login" className="flex w-full max-w-xs flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <input
        type="password"
        name="password"
        placeholder="비밀번호"
        autoComplete="current-password"
        autoFocus
        required
        className="rounded-lg border border-zinc-300 px-3 py-2"
      />
      {error && <p className="text-sm text-red-600">비밀번호가 맞지 않아요.</p>}
      <button type="submit" className="rounded-lg bg-zinc-900 px-3 py-2 text-white">
        들어가기
      </button>
    </form>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-xl font-semibold">취업 일정</h1>
      <Suspense>
        <LoginForm searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
