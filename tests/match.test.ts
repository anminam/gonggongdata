import { describe, expect, it } from "vitest";
import { hasAnyRule, matchKeywords, matchNotice, typeAllowed, type AlertRule, type MatchableNotice } from "@/lib/match";

const N = (o: Partial<MatchableNotice> = {}): MatchableNotice => ({
  title: "[기상청] 서리발생 예측정보 OPEN API 변경",
  api_names: "기상청_서리발생 조회서비스",
  org: "기상청",
  body: "담당자 국가기후데이터센터",
  notice_type: "URL 변경",
  ...o,
});
const R = (o: Partial<AlertRule> = {}): AlertRule => ({ keywords: [], orgs: [], searchBody: false, types: null, ...o });

describe("matchKeywords: 키워드 매칭", () => {
  it("기관명에서 찾는다", () => expect(matchKeywords(N(), ["기상청"], false)).toEqual(["기상청"]));
  it("대소문자를 무시한다", () => expect(matchKeywords(N(), ["open api"], false)).toHaveLength(1));
  it("OR 조건 — 걸린 키워드만 돌려준다", () => expect(matchKeywords(N(), ["조달청", "서리"], false)).toEqual(["서리"]));
  it("본문 검사를 끄면 본문은 보지 않는다", () => expect(matchKeywords(N(), ["국가기후"], false)).toEqual([]));
  it("본문 검사를 켜면 본문도 본다", () => expect(matchKeywords(N(), ["국가기후"], true)).toEqual(["국가기후"]));
  it("키워드가 없으면 빈 결과", () => expect(matchKeywords(N(), [], true)).toEqual([]));
  it("null 필드도 안전하다", () => expect(matchKeywords({ title: "x", api_names: null, org: null, body: null }, ["x"], true)).toEqual(["x"]));
});

describe("typeAllowed: 받을 유형", () => {
  it("types가 null이면 모든 유형을 받는다", () => expect(typeAllowed(N({ notice_type: "일시 중단(점검)" }), null)).toBe(true));
  it("선택한 유형만 받는다", () => {
    expect(typeAllowed(N({ notice_type: "URL 변경" }), ["URL 변경"])).toBe(true);
    expect(typeAllowed(N({ notice_type: "일시 중단(점검)" }), ["URL 변경"])).toBe(false);
  });
  it("유형이 없는 공지는 '기타'로 본다", () => {
    expect(typeAllowed(N({ notice_type: null }), ["기타"])).toBe(true);
    expect(typeAllowed(N({ notice_type: null }), ["URL 변경"])).toBe(false);
  });
  it("빈 배열이면 아무것도 받지 않는다", () => expect(typeAllowed(N(), [])).toBe(false));
});

describe("matchNotice: 알림 조건 (키워드 OR 기관, 받는 유형만)", () => {
  it("키워드가 걸려도 받지 않는 유형이면 제외", () => {
    expect(matchNotice(N({ notice_type: "일시 중단(점검)" }), R({ keywords: ["기상청"], types: ["URL 변경"] }))).toEqual([]);
  });
  it("구독 기관 공지는 키워드 없이도 걸린다", () => {
    expect(matchNotice(N({ org: "조달청", title: "x", api_names: null }), R({ orgs: ["조달청"] }))).toEqual(["기관:조달청"]);
  });
  it("기관명은 정확히 같아야 한다 (부분 일치 X)", () => {
    expect(matchNotice(N({ org: "조달청 산하기관" }), R({ orgs: ["조달청"] }))).toEqual([]);
  });
  it("키워드와 기관이 둘 다 걸리면 이유를 둘 다 돌려준다", () => {
    expect(matchNotice(N(), R({ keywords: ["서리"], orgs: ["기상청"] }))).toEqual(["서리", "기관:기상청"]);
  });
  it("기관 구독도 유형 필터를 따른다", () => {
    expect(matchNotice(N({ notice_type: "일시 중단(점검)" }), R({ orgs: ["기상청"], types: ["URL 변경"] }))).toEqual([]);
  });
  it("공지 기관이 null이면 기관 매칭을 하지 않는다", () => {
    expect(matchNotice(N({ org: null, title: "x", api_names: null }), R({ orgs: ["기상청"] }))).toEqual([]);
  });
});

describe("hasAnyRule", () => {
  it("키워드·기관이 모두 없으면 false", () => expect(hasAnyRule(R())).toBe(false));
  it("기관만 있어도 true", () => expect(hasAnyRule(R({ orgs: ["x"] }))).toBe(true));
  it("키워드만 있어도 true", () => expect(hasAnyRule(R({ keywords: ["x"] }))).toBe(true));
});
