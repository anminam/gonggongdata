import nodemailer, { type Transporter } from "nodemailer";
import { classify } from "./classify";

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

let transporter: Transporter | null = null;
export async function sendMail(to: string[], mail: { subject: string; text: string; html: string }) {
  transporter ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  await transporter.sendMail({
    from: `"공공데이터 공지 알림" <${process.env.GMAIL_USER}>`,
    to: to.join(", "),
    ...mail,
  });
}
