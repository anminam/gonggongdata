import { beforeEach, describe, expect, it, vi } from "vitest";

// 실제 메일·크롤링·DB는 쓰지 않는다
const sendMail = vi.fn(async () => {});
vi.mock("@/lib/mailer", async (orig) => ({ ...(await orig<typeof import("@/lib/mailer")>()), sendMail }));
vi.mock("@/lib/crawler", async (orig) => ({ ...(await orig<typeof import("@/lib/crawler")>()), fetchNoticeList: async () => [] }));

let paused = false;
let calls: [string, string, ...unknown[]][] = [];
const results: Record<string, unknown> = {
  gd_run_logs: { data: { id: 1 }, error: null },
  gd_notices: {
    data: [{ notice_id: "A", org: "기상청", title: "[기상청] 공지", api_names: null, registered_at: "2026-11-05", body: "", url: "u", notice_type: "URL 변경" }],
    error: null,
  },
  gd_profiles: {
    data: [{ user_id: "u1", email: "u1@example.com", gd_user_settings: { enabled: true }, gd_keywords: [], gd_org_subscriptions: [{ org: "기상청" }], gd_recipients: [{ email: "to@example.com" }] }],
    error: null,
  },
  gd_deliveries: { data: [], error: null },
};

/** 어떤 메서드를 이어 불러도 같은 객체를 돌려주고, await하면 테이블별 결과를 주는 가짜 DB */
function table(name: string) {
  const result = name === "gd_app_settings" ? { data: { mail_paused: paused }, error: null } : results[name];
  const c: object = new Proxy({}, {
    get: (_, k) => (k === "then" ? (res: (v: unknown) => void) => res(result) : (...a: unknown[]) => (calls.push([name, String(k), ...a]), c)),
  });
  return c;
}
vi.mock("@/lib/supabase", () => ({ adminClient: () => ({ from: table }) }));

const { runDaily, BUSY_MESSAGE } = await import("@/lib/run");

beforeEach(() => {
  sendMail.mockClear();
  calls = [];
});

describe("runDaily: 발송 일시정지", () => {
  it("일시정지면 수집만 하고 메일은 보내지 않는다", async () => {
    paused = true;
    const r = await runDaily();
    expect(r).toMatchObject({ ok: true, mailPaused: true, emailsSent: 0 });
    expect(sendMail).not.toHaveBeenCalled();
    expect(calls).toContainEqual(["gd_run_logs", "update", expect.objectContaining({ status: "success", emails_sent: 0 })]);
  });

  it("일시정지가 아니면 평소처럼 보낸다", async () => {
    paused = false;
    const r = await runDaily();
    expect(r).toMatchObject({ ok: true, mailPaused: false, emailsSent: 1 });
    expect(sendMail).toHaveBeenCalledTimes(1);
  });
});

describe("runDaily: 중복·누락 막기", () => {
  const profile = (id: string) => ({ user_id: id, email: `${id}@example.com`, gd_user_settings: { enabled: true }, gd_keywords: [], gd_org_subscriptions: [{ org: "기상청" }], gd_recipients: [{ email: `${id}-to@example.com` }] });
  const original = { logs: results.gd_run_logs, profiles: results.gd_profiles };
  beforeEach(() => {
    paused = false;
    results.gd_run_logs = original.logs;
    results.gd_profiles = original.profiles;
  });

  it("이미 다른 실행이 돌고 있으면(running 고유 인덱스 충돌) 아무것도 하지 않는다", async () => {
    results.gd_run_logs = { data: null, error: { code: "23505", message: "duplicate key" } };
    const r = await runDaily();
    expect(r).toMatchObject({ ok: false, error: BUSY_MESSAGE });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("멈춘 running 기록을 먼저 정리한다", async () => {
    await runDaily();
    expect(calls).toContainEqual(["gd_run_logs", "update", expect.objectContaining({ status: "error", error: "시간 초과로 중단됨" })]);
  });

  it("한 사람 발송이 실패해도 나머지에게는 보내고, 실패는 기록에 남긴다", async () => {
    results.gd_profiles = { data: [profile("u1"), profile("u2"), profile("u3")], error: null };
    sendMail.mockImplementationOnce(async () => {
      throw new Error("수신 거부");
    });
    const r = await runDaily();
    expect(sendMail).toHaveBeenCalledTimes(3);
    expect(r).toMatchObject({ ok: true, emailsSent: 2, failed: 1 });
    expect(calls).toContainEqual(["gd_run_logs", "update", expect.objectContaining({ status: "success", emails_sent: 2, error: expect.stringContaining("발송 실패 1명") })]);
  });
});
