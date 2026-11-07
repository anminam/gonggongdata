import { adminClient, userFromRequest } from "@/lib/supabase";
import { checkCode, MAX_ATTEMPTS, type VerificationRow } from "@/lib/emailVerify";

export const dynamic = "force-dynamic";

const MESSAGE = {
  none: "먼저 인증 코드를 받아 주세요.",
  expired: "코드가 만료됐어요. 다시 받아 주세요.",
  locked: "여러 번 틀려서 이 코드는 쓸 수 없어요. 다시 받아 주세요.",
} as const;

// 인증 코드 확인 → 맞으면 프로필 이메일 저장·승인 방식 적용·수신 주소 등록 (DB 함수 한 번에)
export async function POST(req: Request) {
  const me = await userFromRequest(req);
  if (!me || me.status === "rejected" || me.email) return Response.json({ error: "인증할 수 없는 계정이에요." }, { status: 403 });
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!/^\s*\d{6}\s*$/.test(code ?? "")) return Response.json({ error: "숫자 6자리를 입력해 주세요." }, { status: 400 });

  const db = adminClient();
  const { data, error } = await db.from("gd_email_verifications").select("*").eq("user_id", me.user_id).maybeSingle();
  if (error) return Response.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 500 });
  const row = data as VerificationRow | null;
  const result = checkCode(row, me.user_id, code!, Date.now());
  if (result !== "ok" && result !== "wrong") return Response.json({ error: MESSAGE[result] }, { status: 400 });

  // 맞든 틀리든 결과를 알려주기 전에 시도 1회를 먼저 쓴다.
  // 읽은 값 그대로일 때만 올라가므로(동시에 보낸 요청은 하나만 성공) 한꺼번에 여러 번 찍어 보는 우회를 막는다.
  const attempts = row!.attempts + 1;
  const { data: claimed, error: claimErr } = await db
    .from("gd_email_verifications")
    .update({ attempts })
    .eq("user_id", me.user_id)
    .eq("attempts", row!.attempts)
    .eq("code_hash", row!.code_hash)
    .lt("attempts", MAX_ATTEMPTS)
    .select("user_id");
  if (claimErr) return Response.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 500 });
  if (!claimed?.length) return Response.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 409 });

  if (result === "wrong") {
    const left = MAX_ATTEMPTS - attempts;
    return Response.json({ error: left > 0 ? `코드가 맞지 않아요. ${left}번 더 시도할 수 있어요.` : MESSAGE.locked }, { status: 400 });
  }

  const { data: status, error: setErr } = await db.rpc("gd_set_verified_email", { p_user: me.user_id, p_email: row!.email });
  if (setErr) return Response.json({ error: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  return Response.json({ ok: true, status });
}
