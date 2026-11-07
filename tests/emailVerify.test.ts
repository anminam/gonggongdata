import { describe, expect, it } from "vitest";
import { MAX_ATTEMPTS, MAX_OTHERS_SAME_EMAIL_PER_DAY, MAX_PER_DAY, MAX_SENDERS_PER_HOUR, abuseCheck, checkCode, hashCode, makeCode, normalizeEmail, sendWindow, type VerificationRow } from "@/lib/emailVerify";

const now = Date.parse("2026-11-06T03:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const row = (over: Partial<VerificationRow> = {}): VerificationRow => ({
  email: "a@b.kr",
  code_hash: hashCode("u1", "123456"),
  expires_at: iso(now + 60_000),
  attempts: 0,
  sent_at: iso(now - 120_000),
  window_start: iso(now - 120_000),
  window_count: 1,
  ...over,
});

describe("normalizeEmail", () => {
  it("공백 제거, 소문자", () => expect(normalizeEmail("  A@Example.KR ")).toBe("a@example.kr"));
  it("잘못된 형식은 null", () => {
    for (const s of ["", "a", "a@b", "a b@c.kr", "a@@b.kr"]) expect(normalizeEmail(s)).toBeNull();
  });
});

describe("makeCode", () => {
  it("숫자 6자리", () => {
    for (let i = 0; i < 50; i++) expect(makeCode()).toMatch(/^\d{6}$/);
  });
});

describe("sendWindow", () => {
  it("처음이면 창 시작", () => expect(sendWindow(null, now)).toEqual({ window_start: iso(now), window_count: 1 }));
  it("60초 안에 다시 보내면 거부", () => expect(sendWindow(row({ sent_at: iso(now - 10_000) }), now)).toHaveProperty("error"));
  it("하루 한도", () => expect(sendWindow(row({ window_count: MAX_PER_DAY }), now)).toHaveProperty("error"));
  it("하루가 지나면 창 초기화", () =>
    expect(sendWindow(row({ window_count: MAX_PER_DAY, window_start: iso(now - 25 * 3600_000) }), now)).toEqual({ window_start: iso(now), window_count: 1 }));
  it("창 안에서는 횟수 증가", () => expect(sendWindow(row({ window_count: 3 }), now)).toMatchObject({ window_count: 4 }));
});

describe("checkCode", () => {
  it("맞는 코드", () => expect(checkCode(row(), "u1", " 123456 ", now)).toBe("ok"));
  it("다른 사용자의 코드로는 통과 못 함", () => expect(checkCode(row(), "u2", "123456", now)).toBe("wrong"));
  it("틀린 코드", () => expect(checkCode(row(), "u1", "000000", now)).toBe("wrong"));
  it("만료", () => expect(checkCode(row({ expires_at: iso(now) }), "u1", "123456", now)).toBe("expired"));
  it("시도 초과면 맞아도 잠김", () => expect(checkCode(row({ attempts: MAX_ATTEMPTS }), "u1", "123456", now)).toBe("locked"));
  it("기록 없음", () => expect(checkCode(null, "u1", "123456", now)).toBe("none"));
});

describe("abuseCheck: 계정 여러 개로 우회하는 남용 막기", () => {
  it("평소에는 통과", () => {
    expect(abuseCheck({ othersLastHour: 0, othersSameEmailToday: 0 })).toBeNull();
    expect(abuseCheck({ othersLastHour: MAX_SENDERS_PER_HOUR - 1, othersSameEmailToday: MAX_OTHERS_SAME_EMAIL_PER_DAY - 1 })).toBeNull();
  });
  it("같은 주소로 다른 계정들이 이미 여러 번 보냈으면 막는다", () => {
    expect(abuseCheck({ othersLastHour: 0, othersSameEmailToday: MAX_OTHERS_SAME_EMAIL_PER_DAY })).toMatch("이 주소로는");
  });
  it("최근 1시간 전체 요청이 많으면 막는다", () => {
    expect(abuseCheck({ othersLastHour: MAX_SENDERS_PER_HOUR, othersSameEmailToday: 0 })).toMatch("요청이 많아요");
  });
});
