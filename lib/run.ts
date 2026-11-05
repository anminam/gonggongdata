import { adminClient } from "./supabase";
import { fetchNoticeList, fetchNoticeBody, PAGE_SIZE, type ListItem } from "./crawler";
import { classify } from "./classify";
import { renderEmail, sendMail, type NoticeRow } from "./mailer";
import { hasAnyRule, matchKeywords, matchNotice, type AlertRule } from "./match";

export { matchKeywords };

const LOOKBACK_DAYS = 7; // 키워드를 새로 추가한 사용자도 최근 7일 공지는 받음
// 하루에 30건 넘게 올라와도 놓치지 않도록, 이미 아는 공지가 나올 때까지 다음 페이지를 읽는다.
// (서버 실행 시간 60초 제한 때문에 최대 페이지 수를 둔다)
export const MAX_PAGES = 3;

type Db = ReturnType<typeof adminClient>;

/** 새 공지 목록: 1페이지부터 읽다가 이미 저장된 공지가 하나라도 나오거나 마지막 페이지면 멈춘다 */
export async function collectFreshNotices(db: Db, fetchPage = fetchNoticeList) {
  const fresh: ListItem[] = [];
  const seen = new Set<string>();
  let pages = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const list = (await fetchPage(page)).filter((i) => !seen.has(i.notice_id));
    pages = page;
    list.forEach((i) => seen.add(i.notice_id));
    if (!list.length) break;
    const { data: known, error } = await db.from("gd_notices").select("notice_id").in("notice_id", list.map((i) => i.notice_id));
    if (error) throw error;
    const knownIds = new Set((known ?? []).map((k) => k.notice_id));
    fresh.push(...list.filter((i) => !knownIds.has(i.notice_id)));
    if (knownIds.size > 0 || list.length < PAGE_SIZE) break;
  }
  return { fresh, pages };
}

/** 사용자 설정을 알림 조건으로 */
export function toRule(
  keywords: string[],
  orgs: string[],
  settings: { search_body?: boolean | null; notify_types?: string[] | null } | null | undefined,
): AlertRule {
  return { keywords, orgs, searchBody: !!settings?.search_body, types: settings?.notify_types ?? null };
}

export async function recentNotices(db = adminClient()) {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 864e5).toISOString().slice(0, 10);
  const { data, error } = await db
    .from("gd_notices")
    .select("notice_id, org, title, api_names, registered_at, body, url, notice_type")
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
    // 1. 목록 (필요하면 여러 페이지)
    const { fresh } = await collectFreshNotices(db);

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
      .select(
        "user_id, gd_user_settings(search_body, enabled, notify_types), gd_keywords(keyword), gd_org_subscriptions(org), gd_recipients(email)",
      )
      .eq("status", "approved");

    for (const u of users ?? []) {
      const settings = Array.isArray(u.gd_user_settings) ? u.gd_user_settings[0] : u.gd_user_settings;
      if (settings && settings.enabled === false) continue;
      const keywords = (u.gd_keywords ?? []).map((k: { keyword: string }) => k.keyword);
      const orgs = (u.gd_org_subscriptions ?? []).map((o: { org: string }) => o.org);
      const recipients = (u.gd_recipients ?? []).map((r: { email: string }) => r.email);
      const rule = toRule(keywords, orgs, settings);
      if (!hasAnyRule(rule) || !recipients.length) continue;

      const { data: sent } = await db.from("gd_deliveries").select("notice_id").eq("user_id", u.user_id);
      const sentIds = new Set((sent ?? []).map((s) => s.notice_id));

      const hits = notices
        .filter((n) => !sentIds.has(n.notice_id))
        .map((n) => ({ ...n, matched: matchNotice(n, rule) }))
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
