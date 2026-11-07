import { adminClient, userFromRequest } from "@/lib/supabase";
import { sendMail, MAIL_COLORS as C } from "@/lib/mailer";
import { abuseCheck, CODE_TTL_MS, DAY_MS, HOUR_MS, hashCode, makeCode, normalizeEmail, sendWindow, type VerificationRow } from "@/lib/emailVerify";

export const dynamic = "force-dynamic";

// 이메일 없이 가입한 사용자(카카오)에게 알림 받을 이메일 인증 코드를 보낸다
export async function POST(req: Request) {
  const me = await userFromRequest(req);
  if (!me || me.status === "rejected" || me.email) return Response.json({ error: "인증할 수 없는 계정이에요." }, { status: 403 });
  const { email: raw } = (await req.json().catch(() => ({}))) as { email?: string };
  const email = normalizeEmail(raw ?? "");
  if (!email) return Response.json({ error: "이메일 형식을 확인해 주세요." }, { status: 400 });

  const db = adminClient();
  const { data: prev, error } = await db.from("gd_email_verifications").select("*").eq("user_id", me.user_id).maybeSingle();
  if (error) return Response.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 500 });
  const win = sendWindow(prev as VerificationRow | null, Date.now());
  if ("error" in win) return Response.json({ error: win.error }, { status: 429 });

  // 다른 계정까지 합친 제한 (표는 계정마다 한 줄이라 '최근에 코드를 받은 다른 계정 수'를 센다)
  const nowMs = Date.now();
  const [others, sameEmail] = await Promise.all([
    db.from("gd_email_verifications").select("user_id", { count: "exact", head: true })
      .neq("user_id", me.user_id).gt("sent_at", new Date(nowMs - HOUR_MS).toISOString()),
    db.from("gd_email_verifications").select("user_id", { count: "exact", head: true })
      .neq("user_id", me.user_id).eq("email", email).gt("sent_at", new Date(nowMs - DAY_MS).toISOString()),
  ]);
  if (others.error || sameEmail.error) return Response.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 500 });
  const abuse = abuseCheck({ othersLastHour: others.count ?? 0, othersSameEmailToday: sameEmail.count ?? 0 });
  if (abuse) return Response.json({ error: abuse }, { status: 429 });

  const code = makeCode();
  const now = new Date();
  const { error: saveErr } = await db.from("gd_email_verifications").upsert({
    user_id: me.user_id,
    email,
    code_hash: hashCode(me.user_id, code),
    expires_at: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
    attempts: 0,
    sent_at: now.toISOString(),
    ...win,
  });
  if (saveErr) return Response.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 500 });

  try {
    await sendMail([email], {
      subject: `[공공데이터 알림] 이메일 인증 코드 ${code}`,
      text: `인증 코드: ${code}\n10분 안에 입력해 주세요.\n요청하지 않았다면 이 메일을 무시하세요.`,
      html:
        `<div style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:${C.bg};padding:32px 16px">` +
        `<div style="max-width:420px;margin:0 auto;background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:28px 24px;text-align:center">` +
        `<div style="font-size:15px;color:${C.text2}">공공데이터 알림 이메일 인증 코드</div>` +
        `<div style="font-size:34px;font-weight:700;letter-spacing:8px;color:${C.text};margin:16px 0">${code}</div>` +
        `<div style="font-size:13px;color:${C.muted};line-height:1.6">10분 안에 입력해 주세요.<br>요청하지 않았다면 이 메일을 무시하세요.</div>` +
        `</div></div>`,
    });
  } catch {
    return Response.json({ error: "인증 메일을 보내지 못했어요. 관리자에게 문의해 주세요." }, { status: 502 });
  }
  return Response.json({ ok: true, email });
}
