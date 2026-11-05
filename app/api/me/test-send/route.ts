import { adminClient, userFromRequest } from "@/lib/supabase";
import { recentNotices, toRule } from "@/lib/run";
import { matchNotice } from "@/lib/match";
import { renderEmail, sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 내 알림 조건(키워드·구독 기관·받을 유형)으로 최근 7일 공지를 내 수신자에게 테스트 발송 (발송 기록은 남기지 않음)
export async function POST(req: Request) {
  const me = await userFromRequest(req);
  if (!me || me.status !== "approved") return new Response("Forbidden", { status: 403 });
  const db = adminClient();
  const [{ data: kw }, { data: og }, { data: rc }, { data: st }] = await Promise.all([
    db.from("gd_keywords").select("keyword").eq("user_id", me.user_id),
    db.from("gd_org_subscriptions").select("org").eq("user_id", me.user_id),
    db.from("gd_recipients").select("email").eq("user_id", me.user_id),
    db.from("gd_user_settings").select("search_body, notify_types").eq("user_id", me.user_id).maybeSingle(),
  ]);
  const rule = toRule((kw ?? []).map((k) => k.keyword), (og ?? []).map((o) => o.org), st);
  const recipients = (rc ?? []).map((r) => r.email);
  if (!recipients.length) return Response.json({ ok: false, error: "수신 메일주소를 먼저 추가하세요" }, { status: 400 });

  const notices = await recentNotices(db);
  let hits = notices
    .map((n) => ({ ...n, matched: matchNotice(n, rule) }))
    .filter((n) => n.matched.length > 0);
  // 매칭이 없으면 형식 확인용으로 최신 1건 샘플
  if (!hits.length && notices[0]) hits = [{ ...notices[0], matched: ["(샘플)"] }];
  if (!hits.length) return Response.json({ ok: false, error: "저장된 공지가 없습니다. 관리자가 먼저 크롤링을 실행해야 합니다." }, { status: 400 });

  try {
    await sendMail(recipients, renderEmail(hits.slice(0, 10), true));
    return Response.json({ ok: true, count: hits.length, recipients });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
