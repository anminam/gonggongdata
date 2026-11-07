import { adminClient, userFromRequest } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// 회원 탈퇴: 이 서비스(gd_)의 내 데이터를 모두 지운다.
// 로그인 계정(auth.users)은 같은 Supabase의 다른 서비스와 함께 쓰므로 지우지 않는다(지우면 다른 서비스 데이터까지 지워짐).
// gd_profiles를 지우면 알림 설정·키워드·구독 기관·수신 주소·발송 이력이 함께 지워진다(on delete cascade).
export async function POST(req: Request) {
  const me = await userFromRequest(req);
  if (!me) return new Response("Unauthorized", { status: 401 });
  if (me.is_admin) return Response.json({ ok: false, error: "관리자 계정은 탈퇴할 수 없어요." }, { status: 400 });

  const db = adminClient();
  const { error: e1 } = await db.from("gd_email_verifications").delete().eq("user_id", me.user_id);
  const { error: e2 } = await db.from("gd_profiles").delete().eq("user_id", me.user_id);
  if (e1 || e2) return Response.json({ ok: false, error: "탈퇴 처리 중 오류가 났어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });

  // 아바타 선택값(로그인 정보의 user_metadata)도 지운다
  await db.auth.admin.updateUserById(me.user_id, { user_metadata: { gd_avatar: null } });
  return Response.json({ ok: true });
}
