// justdo 연결을 확인하고 지금 바로 접수 기간을 보낸다.  사용법: pnpm justdo
// 앱에서 결정을 바꿀 때도 자동으로 보내지만, 처음 연결했을 때나 잘 되는지 볼 때 쓴다.
import "./env";

async function main() {
  const { justdoConfigured, syncJustdo } = await import("../src/lib/justdo/sync");
  if (!justdoConfigured()) {
    console.log("justdo 연동이 꺼져 있어요. .env.local에 JUSTDO_API_URL과 JUSTDO_API_TOKEN을 넣어 주세요 (docs/setup/justdo.md).");
    process.exit(1);
  }

  try {
    const r = await syncJustdo();
    console.log("✅ justdo에 연결됐어요.");
    if (r.sent === 0) {
      console.log("보낼 공고가 아직 없어요. 앱에서 마감이 남은 공고를 [지원]으로 고르면 justdo \"취업\" 카테고리에 할 일로 들어가요.");
    } else {
      console.log(`보낸 공고 ${r.sent}건 → 새로 추가 ${r.created}, 수정 ${r.updated}, 삭제 ${r.deleted}, 그대로 ${r.unchanged}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`❌ justdo로 보내지 못했어요: ${msg}`);
    if (msg.includes("401")) {
      console.log("토큰이 틀렸거나 연결이 끊긴 토큰이에요. justdo 설정 → 외부 연동에서 새 토큰을 만들어 JUSTDO_API_TOKEN에 다시 넣어 주세요(앞뒤 공백·따옴표 없이).");
    } else if (/fetch failed|Failed to parse URL|ENOTFOUND|timeout/i.test(msg)) {
      console.log("justdo 주소에 닿지 못했어요. JUSTDO_API_URL이 https://www.justdo.co.kr 인지, 인터넷이 연결돼 있는지 확인해 주세요.");
    }
    process.exit(1);
  }
}

main().then(() => process.exit(0));
