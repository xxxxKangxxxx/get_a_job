// 개인정보처리방침 (로그인 없이 공개). 구글 OAuth 동의 화면의 링크용.
export const metadata = { title: "개인정보처리방침 · 취업 일정" };

export default function PrivacyPage() {
  // 설치한 사람의 연락처 (환경변수 CONTACT_EMAIL). 구글 OAuth 동의 화면에 이 페이지를 쓸 때 필요하다.
  const contact = process.env.CONTACT_EMAIL;
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 text-[15px] leading-7">
      <h1 className="mb-6 text-2xl font-semibold">개인정보처리방침</h1>
      <p className="mb-6 text-sm text-zinc-500">시행일: 2026년 10월 24일</p>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">1. 앱 소개</h2>
        <p>&ldquo;취업 일정&rdquo;은 설치한 사람 본인만 사용하는 개인용 앱입니다. 다른 사용자의 가입이나 이용을 받지 않습니다.</p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">2. 구글 캘린더에서 사용하는 정보</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>내 캘린더의 <b>바쁜 시간대(FreeBusy)</b>만 읽습니다. 일정의 제목·내용·참석자·장소는 읽지 않습니다.</li>
          <li>앱이 직접 만든 &ldquo;취업 일정&rdquo; 캘린더에만 일정을 만들고, 고치고, 지웁니다. 다른 캘린더의 일정은 바꾸지 않습니다.</li>
          <li>연결한 구글 계정의 이메일 주소를 연결 상태 표시에만 사용합니다.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">3. 저장과 제공</h2>
        <p>받은 정보(바쁜 시간대, 접근 토큰, 앱이 만든 일정의 식별자)는 앱의 데이터베이스(Neon)에만 저장하며, 제3자에게 제공하거나 판매하지 않습니다. 광고나 분석 목적으로 사용하지 않습니다.</p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">4. 연결 해제와 삭제</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>앱에서 연결 해제(<code>/api/google/disconnect</code>)하면 &ldquo;취업 일정&rdquo; 캘린더와 저장된 토큰·바쁜 시간 정보가 삭제되고 구글 접근 권한이 취소됩니다.</li>
          <li>
            또는 구글 계정의{" "}
            <a className="underline" href="https://myaccount.google.com/permissions">보안 → 타사 앱 및 서비스</a>
            에서 &ldquo;취업 일정&rdquo;의 접근 권한을 삭제할 수 있습니다.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">5. 연락처</h2>
        {contact ? (
          <p>
            <a className="underline" href={`mailto:${contact}`}>{contact}</a>
          </p>
        ) : (
          <p>이 앱을 설치한 운영자에게 문의해 주세요.</p>
        )}
      </section>
    </main>
  );
}
