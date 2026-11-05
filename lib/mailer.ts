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
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function renderEmail(notices: (NoticeRow & { matched: string[] })[], test = false) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const subject = `${test ? "[테스트] " : ""}🚨 공공데이터 API 변경공지 감지 ${notices.length}건 (${today})`;

  const blocks = notices.map((n) => {
    const c = classify(n.title, n.body ?? "");
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
    const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n링크: ${n.url}`;
    const html =
      `<table style="border-collapse:collapse;margin:0 0 20px;width:100%;max-width:640px;font-size:14px">` +
      rows
        .map(
          ([k, v]) =>
            `<tr><th style="text-align:left;padding:6px 10px;background:#f3f4f6;width:110px;border:1px solid #e5e7eb">${esc(k)}</th>` +
            `<td style="padding:6px 10px;border:1px solid #e5e7eb">${esc(v)}</td></tr>`,
        )
        .join("") +
      `<tr><th style="text-align:left;padding:6px 10px;background:#f3f4f6;border:1px solid #e5e7eb">링크</th>` +
      `<td style="padding:6px 10px;border:1px solid #e5e7eb"><a href="${esc(n.url)}">공지 원문 보기</a></td></tr></table>`;
    return { text, html };
  });

  const footer = `이 메일은 gonggongdata.anminam.com 에서 설정한 키워드로 자동 발송되었습니다.`;
  return {
    subject,
    text: `🚨 공공데이터 API 변경공지 감지\n\n${blocks.map((b) => b.text).join("\n\n---\n\n")}\n\n${footer}`,
    html:
      `<div style="font-family:-apple-system,'Malgun Gothic',sans-serif;color:#111">` +
      `<h2 style="margin:0 0 16px">🚨 공공데이터 API 변경공지 감지 (${notices.length}건)</h2>` +
      blocks.map((b) => b.html).join("") +
      `<p style="color:#6b7280;font-size:12px">${footer}</p></div>`,
  };
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
