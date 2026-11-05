import nodemailer from "nodemailer";
import { classify } from "./classify";
import { adminClient } from "./supabase";

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

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function renderEmail(notices: (NoticeRow & { matched: string[] })[], test = false) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const subject = `${test ? "[테스트] " : ""}🚨 공공데이터 API 변경공지 감지 ${notices.length}건 (${today})`;

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
    rows.push(["매칭 키워드", n.matched.join(", ")]);
    return rows.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n링크: ${n.url}`;
  });

  // ---- HTML 버전 (메일 프로그램 호환을 위해 표 + 인라인 스타일) ----
  const font = `-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif`;
  const counts = new Map<string, number>();
  for (const { c } of classified) counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
  const summary = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, k]) => `${badge(t)}<span style="color:#475569;font-size:13px;margin:0 12px 0 4px">${k}건</span>`)
    .join("");

  const cards = classified
    .map(({ n, c }) => {
      const rows: [string, string][] = [
        ["기관", esc(n.org ?? "-")],
        ["API", esc(n.api_names || "-")],
        ["공지일", esc(n.registered_at ?? "-")],
        ["영향", esc(c.impact)],
        ["조치", `<b style="color:#0f172a">${esc(c.action)}</b>`],
      ];
      if (c.newUrl) rows.push(["신규 URL", `<a href="${esc(c.newUrl)}" style="color:#2563eb;word-break:break-all">${esc(c.newUrl)}</a>`]);
      rows.push([
        "키워드",
        n.matched
          .map((k) => `<span style="display:inline-block;background:#eff4ff;color:#2563eb;border-radius:4px;padding:1px 6px;font-size:12px;font-weight:600;margin:0 4px 2px 0">${esc(k)}</span>`)
          .join(""),
      ]);
      return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;margin:0 0 14px;background:#ffffff">` +
        `<tr><td style="padding:16px 18px 6px">${badge(c.type)}` +
        `<div style="font-size:16px;font-weight:700;color:#0f172a;line-height:1.45;margin-top:8px">${esc(n.title)}</div></td></tr>` +
        `<tr><td style="padding:6px 18px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5">` +
        rows
          .map(
            ([k, v]) =>
              `<tr><td valign="top" style="width:64px;padding:4px 0;color:#64748b;white-space:nowrap">${k}</td>` +
              `<td valign="top" style="padding:4px 0;color:#334155">${v}</td></tr>`,
          )
          .join("") +
        `</table></td></tr>` +
        `<tr><td style="padding:10px 18px 16px"><a href="${esc(n.url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:8px 14px;border-radius:6px">공지 원문 보기 →</a></td></tr>` +
        `</table>`
      );
    })
    .join("");

  const site = "https://gonggongdata.anminam.com";
  const html =
    `<div style="background:#f4f6f9;padding:24px 12px;font-family:${font}">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto">` +
    `<tr><td style="background:#2563eb;border-radius:12px 12px 0 0;padding:20px 22px;color:#ffffff">` +
    `<div style="font-size:12px;opacity:.85;letter-spacing:.02em">공공데이터 API 공지 알림${test ? " · 테스트" : ""}</div>` +
    `<div style="font-size:20px;font-weight:700;margin-top:4px">변경 공지 ${notices.length}건이 감지됐어요</div>` +
    `<div style="font-size:13px;opacity:.85;margin-top:2px">${today} 기준 · 내 키워드에 걸린 공지</div>` +
    `</td></tr>` +
    `<tr><td style="background:#ffffff;padding:14px 22px;border:1px solid #e2e8f0;border-top:0">${summary}</td></tr>` +
    `<tr><td style="padding:16px 0 0">${cards}</td></tr>` +
    `<tr><td style="padding:8px 4px 0;color:#94a3b8;font-size:12px;line-height:1.6">` +
    `이 메일은 <a href="${site}" style="color:#64748b">gonggongdata.anminam.com</a>에서 설정한 키워드로 자동 발송됐어요. ` +
    `키워드나 수신 주소는 <a href="${site}" style="color:#64748b">알림 설정</a>에서 바꿀 수 있어요.` +
    `</td></tr></table></div>`;

  const footer = `이 메일은 gonggongdata.anminam.com 에서 설정한 키워드로 자동 발송되었습니다.`;
  return {
    subject,
    text: `🚨 공공데이터 API 변경공지 감지 (${notices.length}건)\n\n${textBlocks.join("\n\n---\n\n")}\n\n${footer}\n${site}`,
    html,
  };
}

// 유형 배지 (색 + 글자). 화면의 배지 색과 맞춘다.
const BADGE: Record<string, [string, string]> = {
  "제공 중단/종료": ["#fef2f2", "#b91c1c"],
  "URL 변경": ["#fff4ed", "#c2410c"],
  "일시 중단(점검)": ["#fefce8", "#a16207"],
  "API 변경": ["#eff6ff", "#1d4ed8"],
  "신규/추가": ["#ecfdf3", "#15803d"],
};
function badge(type: string) {
  const [bg, fg] = BADGE[type] ?? ["#f1f5f9", "#475569"];
  return `<span style="display:inline-block;background:${bg};color:${fg};border-radius:5px;padding:2px 8px;font-size:12px;font-weight:700">${esc(type)}</span>`;
}

// 관리자가 Google 로그인으로 연결한 Gmail 계정(gd_mail_sender)으로 발송.
// SMTP 대신 Gmail API(HTTPS)를 써서 서버리스에서 연결이 멈추지 않게 하고, 모든 호출에 타임아웃을 둔다.
const TIMEOUT_MS = 15_000;
// 메시지(MIME)만 만들고 실제 전송은 하지 않는 트랜스포트
const composer = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });

async function getSender() {
  const { data, error } = await adminClient().from("gd_mail_sender").select("email, refresh_token").eq("id", 1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("연결된 Gmail 발송 계정이 없습니다. 관리자 탭에서 'Gmail 발송 계정 연결'을 눌러주세요.");
  return data as { email: string; refresh_token: string };
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
  const accessToken = await getAccessToken(sender.refresh_token);
  const { message } = await composer.sendMail({
    from: `"공공데이터 공지 알림" <${sender.email}>`,
    to: to.join(", "),
    ...mail,
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
