import { adminClient, userFromRequest } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function requireAdmin(req: Request) {
  const me = await userFromRequest(req);
  return me?.is_admin && me.status === "approved" ? me : null;
}

// 현재 연결된 발송 계정 (토큰은 돌려주지 않음)
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return new Response("Forbidden", { status: 403 });
  const { data } = await adminClient().from("gd_mail_sender").select("email, updated_at").eq("id", 1).maybeSingle();
  return Response.json({ sender: data });
}

// Google 로그인(gmail.send 권한)으로 받은 갱신 토큰 저장
export async function POST(req: Request) {
  const me = await requireAdmin(req);
  if (!me) return new Response("Forbidden", { status: 403 });
  const { refresh_token } = await req.json().catch(() => ({}));
  if (typeof refresh_token !== "string" || !refresh_token) {
    return Response.json({ ok: false, error: "refresh_token 없음" }, { status: 400 });
  }
  const { error } = await adminClient().from("gd_mail_sender").upsert({
    id: 1,
    email: me.email,
    refresh_token,
    connected_by: me.user_id,
    updated_at: new Date().toISOString(),
  });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, email: me.email });
}
