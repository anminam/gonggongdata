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

// 동시 실행 막기: 'running' 기록은 하나만 있을 수 있다(DB 고유 인덱스).
// 서버 시간 제한(60초)으로 'running'에 멈춘 기록은 이 시간이 지나면 정리해서 잠금을 푼다
export const RUN_STALE_MS = 3 * 60_000;
export const BUSY_MESSAGE = "이미 다른 실행이 진행 중이에요. 잠시 후 다시 시도해 주세요.";
// 60초 안에 기록까지 끝내도록 발송은 시작 후 45초까지만, 3명씩 동시에. 못 보낸 사람은 기록이 없으니 다음 실행 때 받는다
export const SEND_BUDGET_MS = 45_000;
export const SEND_CONCURRENCY = 3;

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** items를 최대 limit개씩 동시에 처리 */
async function eachLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

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
  const started = Date.now();
  await db
    .from("gd_run_logs")
    .update({ status: "error", finished_at: new Date(started).toISOString(), error: "시간 초과로 중단됨" })
    .eq("status", "running")
    .lt("started_at", new Date(started - RUN_STALE_MS).toISOString());
  const { data: log, error: lockErr } = await db.from("gd_run_logs").insert({}).select("id").single();
  if (lockErr) {
    if (lockErr.code === "23505") return { ok: false as const, error: BUSY_MESSAGE };
    throw lockErr;
  }
  let newCount = 0;
  let emails = 0;
  const failures: string[] = [];
  let deferred = 0;
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
      // 한 사람이 실패해도 나머지에게는 계속 보낸다
      await eachLimited(await loadAlertUsers(db), SEND_CONCURRENCY, async (u) => {
        if (Date.now() - started > SEND_BUDGET_MS) {
          deferred++;
          return;
        }
        try {
          const r = await deliverToUser(db, u, notices, { resend: false, subjectTemplate: settings.subject_template });
          if (r.status === "sent") emails++;
        } catch (e) {
          console.error("deliver fail", u.user_id, e);
          failures.push(`${u.email || u.user_id}: ${errMsg(e)}`);
        }
      });
    }

    const problems = [
      ...(failures.length ? [`발송 실패 ${failures.length}명 (${failures.slice(0, 3).join(" / ")})`] : []),
      ...(deferred ? [`시간이 모자라 ${deferred}명은 다음 실행 때 보냄`] : []),
    ];
    await db
      .from("gd_run_logs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        new_notices: newCount,
        emails_sent: emails,
        error: problems.length ? problems.join(" · ") : null,
      })
      .eq("id", log?.id);
    return { ok: true as const, newNotices: newCount, emailsSent: emails, failed: failures.length, deferred, mailPaused: settings.mail_paused };
  } catch (e) {
    const msg = errMsg(e);
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
  const rows = hits.map((h) => ({
    user_id: u.user_id,
    notice_id: h.notice_id,
    matched_keywords: h.matched,
    recipients: u.recipients,
    sent_at: new Date().toISOString(),
  }));
  // 메일은 이미 나갔으니 기록이 빠지면 다음 날 또 간다 → 저장 실패 시 한 번 더 시도
  let { error } = await db.from("gd_deliveries").upsert(rows, { onConflict: "user_id,notice_id" });
  if (error) ({ error } = await db.from("gd_deliveries").upsert(rows, { onConflict: "user_id,notice_id" }));
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
