import nodemailer from "nodemailer";
import { classify } from "./classify";
import { adminClient } from "./supabase";
import { ORG_PREFIX } from "./match";
import { findAvatar } from "./avatars";
import { fillSubject } from "./settings";

export type NoticeRow = {
  notice_id: string;
  org: string | null;
  title: string;
  api_names: string | null;
  registered_at: string | null;
  body: string | null;
  url: string;
  notice_type?: string | null;
};

const site = "https://gonggongdata.anminam.com";
// 머리말 아이콘 자리. 발송 시 관리자 프로필 이미지가 있으면 그 이미지로 바뀐다.
const ICON = "🔔";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function renderEmail(notices: (NoticeRow & { matched: string[] })[], test = false, subjectTemplate?: string | null) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const subject = `${test ? "[테스트] " : ""}${fillSubject(subjectTemplate, notices.length, today)}`;

  const classified = notices.map((n) => ({ n, c: classify(n.title, n.body ?? "") }));

  // ---- 텍스트 버전 ----
  const textBlocks = classified.map(({ n, c }) => {
    const rows: [string, string][] = [
      ["API", n.api_names || n.title],
      ["제목", n.title],
      ["기관", n.org ?? ""],
      ["유형", c.type],
      ["공지일", n.registered_at ?? ""],
      ["영향", c.impact],
      ["조치", c.action],
    ];
    if (c.newUrl) rows.push(["신규 URL", c.newUrl]);
    rows.push(["알림 이유", n.matched.map((m) => (m.startsWith(ORG_PREFIX) ? `기관 ${m.slice(ORG_PREFIX.length)}` : m)).join(", ")]);
    return rows.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n링크: ${n.url}`;
  });

  // ---- HTML 버전 (메일 프로그램 호환을 위해 표 + 인라인 스타일, 화면과 같은 흑백 테마) ----
  const font = `-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif`;
  const counts = new Map<string, number>();
  for (const { c } of classified) counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
  const summary = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, k]) => `<span style="display:inline-block;margin:0 14px 6px 0">${badge(t)}<span style="color:${C.muted};font-size:13px;margin-left:6px">${k}건</span></span>`)
    .join("");

  const cards = classified
    .map(({ n, c }) => {
      const rows: [string, string][] = [
        ["기관", esc(n.org ?? "-")],
        ["API", esc(n.api_names || "-")],
        ["공지일", esc(n.registered_at ?? "-")],
        ["영향", esc(c.impact)],
        ["조치", `<b style="color:${C.text}">${esc(c.action)}</b>`],
      ];
      if (c.newUrl) rows.push(["신규 URL", `<a href="${esc(c.newUrl)}" style="color:${C.text};text-decoration:underline;word-break:break-all">${esc(c.newUrl)}</a>`]);
      rows.push(["알림 이유", n.matched.map(reasonChip).join("")]);
      return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:12px;margin:0 0 12px;background:${C.card}">` +
        `<tr><td style="padding:18px 20px 4px">${badge(c.type)}` +
        `<div style="font-size:16px;font-weight:600;color:${C.text};line-height:1.45;margin-top:10px">${esc(n.title)}</div></td></tr>` +
        `<tr><td style="padding:8px 20px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.55">` +
        rows
          .map(
            ([k, v]) =>
              `<tr><td valign="top" style="width:72px;padding:4px 0;color:${C.muted};white-space:nowrap">${k}</td>` +
              `<td valign="top" style="padding:4px 0;color:${C.text2}">${v}</td></tr>`,
          )
          .join("") +
        `</table></td></tr>` +
        `<tr><td style="padding:12px 20px 18px"><a href="${esc(n.url)}" style="display:inline-block;background:${C.primary};color:#ffffff;text-decoration:none;font-size:13px;font-weight:500;padding:9px 16px;border-radius:8px">공지 원문 보기 →</a></td></tr>` +
        `</table>`
      );
    })
    .join("");

  const html =
    `<div style="background:${C.bg};padding:28px 12px;font-family:${font};color:${C.text}">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto">` +
    // 머리말: 화면 사이드바 로고와 같은 검은 사각 아이콘 + 서비스 이름
    `<tr><td style="padding:0 4px 16px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>` +
    ICON_CELL +
    `<td style="padding-left:10px;font-size:14px;font-weight:600;color:${C.text}">공공데이터 알림<div style="font-size:12px;font-weight:400;color:${C.muted}">API 공지 모니터링${test ? " · 테스트 발송" : ""}</div></td>` +
    `</tr></table></td></tr>` +
    // 요약 카드
    `<tr><td style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:20px 22px">` +
    `<div style="font-size:13px;color:${C.muted}">${today} 기준 · 내 알림 조건에 걸린 공지</div>` +
    `<div style="font-size:22px;font-weight:600;letter-spacing:-0.01em;margin:4px 0 14px">변경 공지 ${notices.length}건이 감지됐어요</div>` +
    `<div>${summary}</div>` +
    `</td></tr>` +
    `<tr><td style="padding:12px 0 0">${cards}</td></tr>` +
    `<tr><td style="padding:8px 4px 0;color:${C.faint};font-size:12px;line-height:1.7">` +
    `이 메일은 <a href="${site}" style="color:${C.muted}">gonggongdata.anminam.com</a>에서 설정한 알림 조건(키워드·구독 기관·받을 유형)으로 자동 발송됐어요. ` +
    `조건이나 수신 주소는 <a href="${site}" style="color:${C.muted}">알림 설정</a>에서 바꿀 수 있어요.` +
    `</td></tr></table></div>`;

  const footer = `이 메일은 gonggongdata.anminam.com 에서 설정한 알림 조건으로 자동 발송되었습니다.`;
  return {
    subject,
    text: `🚨 공공데이터 API 변경공지 감지 (${notices.length}건)\n\n${textBlocks.join("\n\n---\n\n")}\n\n${footer}\n${site}`,
    html,
  };
}

// 화면(shadcn neutral 테마)과 맞춘 색
export const MAIL_COLORS = {
  bg: "#fafafa",
  card: "#ffffff",
  border: "#e5e5e5",
  text: "#0a0a0a",
  text2: "#404040",
  muted: "#737373",
  faint: "#a3a3a3",
  primary: "#171717",
  chip: "#f5f5f5",
};
const C = MAIL_COLORS;
const ICON_CELL = `<td style="width:32px;height:32px;background:${C.primary};border-radius:8px;text-align:center;vertical-align:middle;color:#ffffff;font-size:15px">${ICON}</td>`;

// 유형 배지 (색 + 아이콘 글자). 화면의 배지 색과 맞춘다. 색만으로 구분하지 않도록 글자를 같이 쓴다.
const BADGE: Record<string, [bg: string, fg: string, border: string]> = {
  "제공 중단/종료": ["#fef2f2", "#b91c1c", "#fecaca"],
  "URL 변경": ["#fff7ed", "#c2410c", "#fed7aa"],
  "일시 중단(점검)": ["#fffbeb", "#b45309", "#fde68a"],
  "API 변경": ["#eff6ff", "#1d4ed8", "#bfdbfe"],
  "신규/추가": ["#ecfdf5", "#047857", "#a7f3d0"],
};
function badge(type: string) {
  const [bg, fg, bd] = BADGE[type] ?? [C.chip, C.text2, C.border];
  return `<span style="display:inline-block;background:${bg};color:${fg};border:1px solid ${bd};border-radius:999px;padding:1px 9px;font-size:12px;font-weight:500;line-height:18px">${esc(type)}</span>`;
}

// 알림 이유 칩: 키워드는 회색, 구독 기관은 테두리 + 🏢
function reasonChip(reason: string) {
  const org = reason.startsWith(ORG_PREFIX);
  const label = org ? `🏢 ${reason.slice(ORG_PREFIX.length)}` : reason;
  const style = org
    ? `background:${C.card};border:1px solid ${C.border};color:${C.text2}`
    : `background:${C.chip};border:1px solid ${C.chip};color:${C.text2}`;
  return `<span style="display:inline-block;${style};border-radius:999px;padding:1px 9px;font-size:12px;line-height:18px;margin:0 4px 4px 0">${esc(label)}</span>`;
}

// 관리자가 Google 로그인으로 연결한 Gmail 계정(gd_mail_sender)으로 발송.
// SMTP 대신 Gmail API(HTTPS)를 써서 서버리스에서 연결이 멈추지 않게 하고, 모든 호출에 타임아웃을 둔다.
const TIMEOUT_MS = 15_000;
// 메시지(MIME)만 만들고 실제 전송은 하지 않는 트랜스포트
const composer = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });

async function getSender() {
  const { data, error } = await adminClient().from("gd_mail_sender").select("email, refresh_token, connected_by").eq("id", 1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("연결된 Gmail 발송 계정이 없습니다. 관리자 탭에서 'Gmail 발송 계정 연결'을 눌러주세요.");
  return data as { email: string; refresh_token: string; connected_by: string | null };
}

// 발송 계정을 연결한 관리자의 프로필 이미지 <img>. 없거나 조회 실패면 null(기본 🔔 유지, 발송은 계속).
async function senderAvatarImg(userId: string | null) {
  if (!userId) return null;
  const { data } = await adminClient().auth.admin.getUserById(userId);
  const avatar = findAvatar(data.user?.user_metadata?.gd_avatar);
  if (!avatar) return null;
  return `<img src="${site}${avatar.src}" width="32" height="32" alt="${esc(avatar.label)}" style="display:block;width:32px;height:32px;border-radius:8px;border:0">`;
}

async function getAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 환경변수가 없습니다.");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !j.access_token) {
    throw new Error(`Google 토큰 갱신 실패 (${res.status}): ${j.error ?? ""} ${j.error_description ?? ""}`.trim());
  }
  return j.access_token;
}

export async function sendMail(to: string[], mail: { subject: string; text: string; html: string }) {
  const sender = await getSender();
  const [accessToken, img] = await Promise.all([
    getAccessToken(sender.refresh_token),
    senderAvatarImg(sender.connected_by).catch(() => null),
  ]);
  const { message } = await composer.sendMail({
    from: `"공공데이터 공지 알림" <${sender.email}>`,
    to: to.join(", "),
    ...mail,
    // 이미지일 땐 검은 배경 칸 대신 배경 없는 칸으로 바꾼다
    html: img ? mail.html.replace(ICON_CELL, `<td style="width:32px;height:32px;vertical-align:middle">${img}</td>`) : mail.html,
  });
  const raw = Buffer.from(message as Buffer).toString("base64url");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(`Gmail 발송 실패 (${res.status}): ${j.error?.message ?? res.statusText}`);
  }
}
