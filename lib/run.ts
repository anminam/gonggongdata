import { adminClient } from "./supabase";
import { fetchNoticeList, fetchNoticeBody, PAGE_SIZE, type ListItem } from "./crawler";
import { classify } from "./classify";
import { renderEmail, sendMail, type NoticeRow } from "./mailer";
import { hasAnyRule, matchKeywords, matchNotice, type AlertRule } from "./match";
import { loadAppSettings } from "./settings";

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

    // 3. 사용자별 발송 (이미 보낸 공지는 빼고). 관리자가 발송을 일시정지했으면 건너뛴다
    const settings = await loadAppSettings(db);
    if (!settings.mail_paused) {
      const notices = await recentNotices(db);
      for (const u of await loadAlertUsers(db)) {
        const r = await deliverToUser(db, u, notices, { resend: false, subjectTemplate: settings.subject_template });
        if (r.status === "sent") emails++;
      }
    }

    await db
      .from("gd_run_logs")
      .update({ status: "success", finished_at: new Date().toISOString(), new_notices: newCount, emails_sent: emails })
      .eq("id", log?.id);
    return { ok: true, newNotices: newCount, emailsSent: emails, mailPaused: settings.mail_paused };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db
      .from("gd_run_logs")
      .update({ status: "error", finished_at: new Date().toISOString(), new_notices: newCount, emails_sent: emails, error: msg })
      .eq("id", log?.id);
    throw e;
  }
}

/** 알림 조건에 걸린 공지 고르기. sentIds를 주면 이미 보낸 공지는 뺀다 (null이면 다시 보내기) */
export function pickHits<T extends NoticeRow>(notices: T[], rule: AlertRule, sentIds: Set<string> | null) {
  return notices
    .filter((n) => !sentIds?.has(n.notice_id))
    .map((n) => ({ ...n, matched: matchNotice(n, rule) }))
    .filter((n) => n.matched.length > 0);
}

export type AlertUser = {
  user_id: string;
  email: string;
  enabled: boolean;
  rule: AlertRule;
  recipients: string[];
};

/** 승인된 사용자와 알림 조건. userIds를 주면 그 사용자만 */
export async function loadAlertUsers(db: Db, userIds?: string[]): Promise<AlertUser[]> {
  let q = db
    .from("gd_profiles")
    .select(
      "user_id, email, gd_user_settings(search_body, enabled, notify_types), gd_keywords(keyword), gd_org_subscriptions(org), gd_recipients(email)",
    )
    .eq("status", "approved");
  if (userIds) q = q.in("user_id", userIds);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((u) => {
    const settings = Array.isArray(u.gd_user_settings) ? u.gd_user_settings[0] : u.gd_user_settings;
    return {
      user_id: u.user_id,
      email: u.email,
      enabled: !(settings && settings.enabled === false),
      rule: toRule(
        (u.gd_keywords ?? []).map((k: { keyword: string }) => k.keyword),
        (u.gd_org_subscriptions ?? []).map((o: { org: string }) => o.org),
        settings,
      ),
      recipients: (u.gd_recipients ?? []).map((r: { email: string }) => r.email),
    };
  });
}

export type DeliverResult = {
  user_id: string;
  email: string;
  status: "sent" | "skipped";
  count: number;
  reason?: string;
};

/**
 * 한 사용자에게 걸린 공지를 메일 1통으로 보낸다.
 * resend=true면 이미 보낸 공지도 다시 보내고(관리자 강제 재발송), 발송 기록은 새로 만들지 않고 시각만 갱신한다.
 * 관리자 재발송은 사용자가 '알림 받기'를 꺼 두었어도 보낸다.
 */
export async function deliverToUser(db: Db, u: AlertUser, notices: NoticeRow[], { resend, subjectTemplate }: { resend: boolean; subjectTemplate?: string | null }): Promise<DeliverResult> {
  const base = { user_id: u.user_id, email: u.email };
  if (!resend && !u.enabled) return { ...base, status: "skipped", count: 0, reason: "알림 꺼짐" };
  if (!hasAnyRule(u.rule)) return { ...base, status: "skipped", count: 0, reason: "알림 조건 없음" };
  if (!u.recipients.length) return { ...base, status: "skipped", count: 0, reason: "수신 주소 없음" };

  let sentIds: Set<string> | null = null;
  if (!resend) {
    const { data: sent, error } = await db.from("gd_deliveries").select("notice_id").eq("user_id", u.user_id);
    if (error) throw error;
    sentIds = new Set((sent ?? []).map((s) => s.notice_id));
  }
  const hits = pickHits(notices, u.rule, sentIds);
  if (!hits.length) return { ...base, status: "skipped", count: 0, reason: resend ? "최근 7일 걸린 공지 없음" : "새 공지 없음" };

  await sendMail(u.recipients, renderEmail(hits, false, subjectTemplate));
  const { error } = await db.from("gd_deliveries").upsert(
    hits.map((h) => ({
      user_id: u.user_id,
      notice_id: h.notice_id,
      matched_keywords: h.matched,
      recipients: u.recipients,
      sent_at: new Date().toISOString(),
    })),
    { onConflict: "user_id,notice_id" },
  );
  if (error) throw error;
  return { ...base, status: "sent", count: hits.length };
}

/** 관리자 테스트 발송: 사용자 조건대로 걸린 최근 7일 공지를 '[테스트]' 제목으로 보낸다. 발송 기록은 남기지 않는다 */
export async function testSendToUsers(userIds: string[]) {
  const db = adminClient();
  const notices = await recentNotices(db);
  const users = await loadAlertUsers(db, userIds);
  const { subject_template } = await loadAppSettings(db);
  const results: DeliverResult[] = [];
  for (const u of users) {
    const base = { user_id: u.user_id, email: u.email };
    try {
      if (!u.recipients.length) {
        results.push({ ...base, status: "skipped", count: 0, reason: "수신 주소 없음" });
        continue;
      }
      let hits = pickHits(notices, u.rule, null);
      // 매칭이 없으면 형식 확인용으로 최신 1건 샘플
      if (!hits.length && notices[0]) hits = [{ ...notices[0], matched: ["(샘플)"] }];
      if (!hits.length) {
        results.push({ ...base, status: "skipped", count: 0, reason: "저장된 공지 없음" });
        continue;
      }
      await sendMail(u.recipients, renderEmail(hits.slice(0, 10), true, subject_template));
      results.push({ ...base, status: "sent", count: Math.min(hits.length, 10) });
    } catch (e) {
      results.push({ ...base, status: "skipped", count: 0, reason: `실패: ${e instanceof Error ? e.message : String(e)}` });
    }
  }
  return results;
}

/** 관리자 강제 재발송: 선택한 사용자에게 최근 7일 걸린 공지를 (이미 보낸 것 포함) 다시 보낸다 */
export async function resendRecent(userIds: string[]) {
  const db = adminClient();
  const notices = await recentNotices(db);
  const users = await loadAlertUsers(db, userIds);
  const { subject_template } = await loadAppSettings(db);
  const results: DeliverResult[] = [];
  for (const u of users) {
    try {
      results.push(await deliverToUser(db, u, notices, { resend: true, subjectTemplate: subject_template }));
    } catch (e) {
      results.push({ user_id: u.user_id, email: u.email, status: "skipped", count: 0, reason: `실패: ${e instanceof Error ? e.message : String(e)}` });
    }
  }
  return results;
}

export const ADMIN_PICK = "(관리자 발송)";

/** 관리자 공지 지정 발송: 고른 공지 1건을 알림 조건과 상관없이 보내고 발송 기록을 남긴다 */
export async function deliverNotice(db: Db, u: AlertUser, n: NoticeRow, subjectTemplate?: string | null): Promise<DeliverResult> {
  const base = { user_id: u.user_id, email: u.email };
  if (!u.recipients.length) return { ...base, status: "skipped", count: 0, reason: "수신 주소 없음" };
  const hit = matchNotice(n, u.rule);
  const matched = hit.length ? hit : [ADMIN_PICK];
  await sendMail(u.recipients, renderEmail([{ ...n, matched }], false, subjectTemplate));
  const { error } = await db.from("gd_deliveries").upsert(
    { user_id: u.user_id, notice_id: n.notice_id, matched_keywords: matched, recipients: u.recipients, sent_at: new Date().toISOString() },
    { onConflict: "user_id,notice_id" },
  );
  if (error) throw error;
  return { ...base, status: "sent", count: 1 };
}

export async function sendNoticeToUsers(noticeId: string, userIds: string[]) {
  const db = adminClient();
  const { data: n, error } = await db
    .from("gd_notices")
    .select("notice_id, org, title, api_names, registered_at, body, url, notice_type")
    .eq("notice_id", noticeId)
    .maybeSingle();
  if (error) throw error;
  if (!n) throw new Error("공지를 찾을 수 없어요");
  const { subject_template } = await loadAppSettings(db);
  const results: DeliverResult[] = [];
  for (const u of await loadAlertUsers(db, userIds)) {
    try {
      results.push(await deliverNotice(db, u, n as NoticeRow, subject_template));
    } catch (e) {
      results.push({ user_id: u.user_id, email: u.email, status: "skipped", count: 0, reason: `실패: ${e instanceof Error ? e.message : String(e)}` });
    }
  }
  return results;
}
