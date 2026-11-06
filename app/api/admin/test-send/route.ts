import { testSendToUsers } from "@/lib/run";
import { userFromRequest } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_USERS = 50;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 관리자 테스트 발송: 선택한 사용자의 알림 조건대로 '[테스트]' 메일을 보낸다 (발송 기록은 남기지 않음)
export async function POST(req: Request) {
  const me = await userFromRequest(req);
  if (!me?.is_admin || me.status !== "approved") return new Response("Forbidden", { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { user_ids?: unknown };
  const ids = Array.isArray(body.user_ids) ? body.user_ids.filter((x): x is string => typeof x === "string" && UUID_RE.test(x)) : [];
  if (!ids.length) return Response.json({ ok: false, error: "보낼 사용자를 골라 주세요" }, { status: 400 });
  if (ids.length > MAX_USERS) return Response.json({ ok: false, error: `한 번에 ${MAX_USERS}명까지 보낼 수 있어요` }, { status: 400 });

  try {
    const results = await testSendToUsers([...new Set(ids)]);
    return Response.json({ ok: true, results });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
