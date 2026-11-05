import { beforeEach, describe, expect, it, vi } from "vitest";

// 실제 메일은 보내지 않는다
const sendMail = vi.fn(async () => {});
vi.mock("@/lib/mailer", async (orig) => ({ ...(await orig<typeof import("@/lib/mailer")>()), sendMail }));

const { deliverToUser, pickHits } = await import("@/lib/run");
type AlertUser = import("@/lib/run").AlertUser;
type NoticeRow = import("@/lib/mailer").NoticeRow;

const notice = (id: string, o: Partial<NoticeRow> = {}): NoticeRow => ({
  notice_id: id, org: "기상청", title: `[기상청] 공지 ${id}`, api_names: null, registered_at: "2026-11-05", body: "", url: "u", notice_type: "URL 변경", ...o,
});
const notices = [notice("A"), notice("B"), notice("C", { org: "조달청" })];
const user = (o: Partial<AlertUser> = {}): AlertUser => ({
  user_id: "u1", email: "u1@example.com", enabled: true, recipients: ["to@example.com"],
  rule: { keywords: [], orgs: ["기상청"], searchBody: false, types: null }, ...o,
});

/** 발송 기록 조회·저장만 흉내 내는 가짜 DB */
function fakeDb(sentIds: string[]) {
  const upserts: { rows: { notice_id: string }[]; opts: unknown }[] = [];
  const db = {
    from: () => ({
      select: () => ({ eq: async () => ({ data: sentIds.map((notice_id) => ({ notice_id })), error: null }) }),
      upsert: async (rows: { notice_id: string }[], opts: unknown) => {
        upserts.push({ rows, opts });
        return { error: null };
      },
    }),
  } as unknown as Parameters<typeof deliverToUser>[0];
  return { db, upserts };
}

beforeEach(() => sendMail.mockClear());

describe("pickHits", () => {
  const rule = { keywords: [], orgs: ["기상청"], searchBody: false, types: null };
  it("이미 보낸 공지는 뺀다", () => expect(pickHits(notices, rule, new Set(["A"])).map((n) => n.notice_id)).toEqual(["B"]));
  it("sentIds가 null이면 이미 보낸 것도 포함 (재발송)", () => expect(pickHits(notices, rule, null).map((n) => n.notice_id)).toEqual(["A", "B"]));
});

describe("deliverToUser: 매일 발송", () => {
  it("새 공지만 보내고 발송 기록을 남긴다", async () => {
    const { db, upserts } = fakeDb(["A"]);
    const r = await deliverToUser(db, user(), notices, { resend: false });
    expect(r).toMatchObject({ status: "sent", count: 1 });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(upserts[0].rows.map((x) => x.notice_id)).toEqual(["B"]);
  });

  it("모두 이미 보냈으면 메일을 보내지 않는다", async () => {
    const { db } = fakeDb(["A", "B"]);
    const r = await deliverToUser(db, user(), notices, { resend: false });
    expect(r).toMatchObject({ status: "skipped", reason: "새 공지 없음" });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("알림을 꺼 둔 사용자는 건너뛴다", async () => {
    const r = await deliverToUser(fakeDb([]).db, user({ enabled: false }), notices, { resend: false });
    expect(r).toMatchObject({ status: "skipped", reason: "알림 꺼짐" });
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe("deliverToUser: 관리자 강제 재발송", () => {
  it("이미 보낸 공지도 다시 보내고, 기록은 새로 만들지 않고 갱신(upsert)한다", async () => {
    const { db, upserts } = fakeDb(["A", "B"]);
    const r = await deliverToUser(db, user(), notices, { resend: true });
    expect(r).toMatchObject({ status: "sent", count: 2 });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(upserts[0].opts).toEqual({ onConflict: "user_id,notice_id" });
  });

  it("알림을 꺼 둔 사용자에게도 보낸다", async () => {
    const r = await deliverToUser(fakeDb([]).db, user({ enabled: false }), notices, { resend: true });
    expect(r.status).toBe("sent");
  });

  it("알림 조건이 없으면 보내지 않는다", async () => {
    const r = await deliverToUser(fakeDb([]).db, user({ rule: { keywords: [], orgs: [], searchBody: false, types: null } }), notices, { resend: true });
    expect(r).toMatchObject({ status: "skipped", reason: "알림 조건 없음" });
  });

  it("수신 주소가 없으면 보내지 않는다", async () => {
    const r = await deliverToUser(fakeDb([]).db, user({ recipients: [] }), notices, { resend: true });
    expect(r).toMatchObject({ status: "skipped", reason: "수신 주소 없음" });
  });

  it("최근 7일에 걸린 공지가 없으면 보내지 않는다", async () => {
    const r = await deliverToUser(fakeDb([]).db, user({ rule: { keywords: [], orgs: ["없는기관"], searchBody: false, types: null } }), notices, { resend: true });
    expect(r).toMatchObject({ status: "skipped", reason: "최근 7일 걸린 공지 없음" });
    expect(sendMail).not.toHaveBeenCalled();
  });
});
