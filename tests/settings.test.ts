import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, DEFAULT_SUBJECT, cleanSubject, fillSubject, loadAppSettings, normalizeDomain } from "@/lib/settings";

describe("fillSubject", () => {
  it("비어 있으면 기본 제목", () => {
    expect(fillSubject(null, 3, "2026-11-06")).toBe("🚨 공공데이터 API 변경공지 감지 3건 (2026-11-06)");
    expect(fillSubject("   ", 3, "2026-11-06")).toBe(fillSubject(DEFAULT_SUBJECT, 3, "2026-11-06"));
  });
  it("칸을 모두 바꾼다", () => {
    expect(fillSubject("{날짜} {건수}/{건수}", 2, "2026-11-06")).toBe("2026-11-06 2/2");
  });
  it("칸이 없으면 그대로, 모르는 칸은 글자 그대로", () => {
    expect(fillSubject("공지 알림 {기관}", 1, "2026-11-06")).toBe("공지 알림 {기관}");
  });
});

describe("cleanSubject", () => {
  it("줄바꿈을 공백으로, 200자 제한", () => {
    expect(cleanSubject(" a\r\nb\nc ")).toBe("a b c");
    expect(cleanSubject("가".repeat(250))).toHaveLength(200);
  });
});

describe("normalizeDomain", () => {
  it("@·공백 제거, 소문자", () => expect(normalizeDomain(" @Example.GO.kr ")).toBe("example.go.kr"));
  it("잘못된 입력은 null", () => {
    for (const s of ["", "  ", "nodot", "a b.kr", "x@y.kr"]) expect(normalizeDomain(s)).toBeNull();
  });
});

describe("loadAppSettings", () => {
  const db = (row: unknown) =>
    ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }) }) as never;
  it("줄이 없으면 기본값", async () => expect(await loadAppSettings(db(null))).toEqual(DEFAULT_SETTINGS));
  it("null 필드는 기본값으로 채운다", async () =>
    expect(await loadAppSettings(db({ mail_paused: true, approval_mode: null, approval_domains: null, subject_template: "x" })))
      .toEqual({ ...DEFAULT_SETTINGS, mail_paused: true, subject_template: "x" }));
});
