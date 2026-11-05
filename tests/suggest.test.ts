import { describe, expect, it } from "vitest";
import { suggestKeywords } from "@/lib/suggest";

const n = (title: string, org: string | null = null, api_names: string | null = null) => ({ title, org, api_names });

describe("suggestKeywords: 추천 키워드", () => {
  const notices = [
    n("[국토교통부] 실거래가 OPEN API 서비스 변경안내", "국토교통부"),
    n("[국토교통부] 마이홈포털 서버 작업으로 인한 Open API 일시 중단 안내", "국토교통부", "국토교통부_마이홈포털 조회서비스"),
    n("[한국토지주택공사] 마이홈포털 서버 점검 안내", "한국토지주택공사"),
    n("[기상청] 서리 예측정보 OPEN API 서비스 변경안내", "기상청"),
  ];

  it("여러 공지에 나온 단어를 많은 순으로 뽑고, 흔한 말·조사 붙은 말은 뺀다", () => {
    const s = suggestKeywords(notices, []);
    // 셋 다 2건씩 → 가나다순
    expect(s).toEqual(["국토교통부", "마이홈포털", "서버"]);
    for (const w of ["API", "OPEN", "서비스", "안내", "변경안내", "작업으로"]) expect(s).not.toContain(w);
  });

  it("한 공지 안에서 여러 번 나와도 1번만 센다 (1건뿐인 단어는 빠진다)", () => {
    expect(suggestKeywords([notices[1]], [])).toEqual([]);
  });

  it("이미 추가한 키워드는 대소문자 무관하게 뺀다", () => {
    expect(suggestKeywords(notices, ["마이홈포털"])).not.toContain("마이홈포털");
  });

  it("개수 제한을 지킨다", () => {
    expect(suggestKeywords(notices, [], 1)).toHaveLength(1);
  });
});
