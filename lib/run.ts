import { adminClient } from "./supabase";
import { fetchNoticeList, fetchNoticeBody } from "./crawler";
import { classify } from "./classify";
import { renderEmail, sendMail, type NoticeRow } from "./mailer";

const LOOKBACK_DAYS = 7; // 키워드를 새로 추가한 사용자도 최근 7일 공지는 받음

export function matchKeywords(n: NoticeRow, keywords: string[], searchBody: boolean) {
  const hay = [n.title, n.api_names, n.org, searchBody ? n.body : ""].join(" ").toLowerCase();
  return keywords.filter((k) => hay.includes(k.toLowerCase()));
}

export async function recentNotices(db = adminClient()) {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 864e5).toISOString().slice(0, 10);
  const { data, error } = await db
    .from("gd_notices")
    .select("notice_id, org, title, api_names, registered_at, body, url")
    .gte("registered_at", since)
    .order("registered_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as NoticeRow[];
}

/** 1) 크롤링 → 2) 신규 공지 저장 → 3) 사용자별 매칭 & 발송 */
export async function runDaily() {
  const db = adminClient();
  const { data: log } = await db.from("gd_run_logs").insert({}).select("id").single();
  let newCount = 0;
  let emails = 0;
  try {
    // 1. 목록
    const list = await fetchNoticeList();
    const { data: known } = await db.from("gd_notices").select("notice_id").in("notice_id", list.map((i) => i.notice_id));
    const knownIds = new Set((known ?? []).map((k) => k.notice_id));
    const fresh = list.filter((i) => !knownIds.has(i.notice_id));

    // 2. 신규 공지 상세 → 저장
    for (const item of fresh) {
      let body = "";
      try {
        body = await fetchNoticeBody(item.notice_id);
      } catch (e) {
        console.error("detail fail", item.notice_id, e);
      }
      const { error } = await db.from("gd_notices").upsert({
        ...item,
        body,
        notice_type: classify(item.title, body).type,
      });
      if (error) throw error;
      newCount++;
    }

    // 3. 사용자별 발송
    const notices = await recentNotices(db);
    const { data: users } = await db
      .from("gd_profiles")
      .select("user_id, gd_user_settings(search_body, enabled), gd_keywords(keyword), gd_recipients(email)")
      .eq("status", "approved");

    for (const u of users ?? []) {
      const settings = Array.isArray(u.gd_user_settings) ? u.gd_user_settings[0] : u.gd_user_settings;
      if (settings && settings.enabled === false) continue;
      const keywords = (u.gd_keywords ?? []).map((k: { keyword: string }) => k.keyword);
      const recipients = (u.gd_recipients ?? []).map((r: { email: string }) => r.email);
      if (!keywords.length || !recipients.length) continue;

      const { data: sent } = await db.from("gd_deliveries").select("notice_id").eq("user_id", u.user_id);
      const sentIds = new Set((sent ?? []).map((s) => s.notice_id));

      const hits = notices
        .filter((n) => !sentIds.has(n.notice_id))
        .map((n) => ({ ...n, matched: matchKeywords(n, keywords, !!settings?.search_body) }))
        .filter((n) => n.matched.length > 0);
      if (!hits.length) continue; // 해당 없으면 메일 안 보냄

      await sendMail(recipients, renderEmail(hits));
      emails++;
      await db.from("gd_deliveries").insert(
        hits.map((h) => ({ user_id: u.user_id, notice_id: h.notice_id, matched_keywords: h.matched, recipients })),
      );
    }

    await db
      .from("gd_run_logs")
      .update({ status: "success", finished_at: new Date().toISOString(), new_notices: newCount, emails_sent: emails })
      .eq("id", log?.id);
    return { ok: true, newNotices: newCount, emailsSent: emails };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db
      .from("gd_run_logs")
      .update({ status: "error", finished_at: new Date().toISOString(), new_notices: newCount, emails_sent: emails, error: msg })
      .eq("id", log?.id);
    throw e;
  }
}
