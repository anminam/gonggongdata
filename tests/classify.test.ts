import { describe, expect, it } from "vitest";
import { classify } from "@/lib/classify";

describe("classify: 공지 유형 분류", () => {
  it("점검 공지 → 일시 중단(점검)", () => {
    expect(classify("[A] 시스템 점검 작업으로 인한 서비스 일시 중단 안내").type).toBe("일시 중단(점검)");
  });

  it("'일시 중단'이 '중단'보다 먼저 잡힌다", () => {
    expect(classify("[A] OPEN API 일시 중단 안내").type).toBe("일시 중단(점검)");
  });

  it.each([
    ["[A] 문화동영상 Open API 제공중단 안내"],
    ["[A] 구 API 폐기 안내"],
    ["[A] 서비스 종료 안내"],
  ])("중단·폐기·종료 → 제공 중단/종료: %s", (title) => {
    expect(classify(title).type).toBe("제공 중단/종료");
  });

  it("제목의 URL 변경 → URL 변경", () => {
    expect(classify("[A] 서비스 URL 변경 안내").type).toBe("URL 변경");
  });

  it("'변경' + 본문 '변경 후 URL' → URL 변경으로 구체화하고 신규 URL을 뽑는다", () => {
    const c = classify("[A] OPEN API 서비스 변경안내", "ㅁ변경 후 URL : https://apis.data.go.kr/1/abcV2 ㅁ담당자");
    expect(c.type).toBe("URL 변경");
    expect(c.newUrl).toBe("https://apis.data.go.kr/1/abcV2");
  });

  it("'변경후 url'(붙여쓰기·소문자)도 인식한다", () => {
    expect(classify("[A] 서비스 변경안내", "변경후 url : https://apis.data.go.kr/x/y").newUrl).toBe("https://apis.data.go.kr/x/y");
  });

  it("'90일 유지' 문구가 있으면 영향에 기간을 덧붙인다", () => {
    expect(classify("[A] URL 변경", "기존 서비스 URL은 90일 유지 후 중단됩니다.").impact).toContain("90일");
  });

  it("파라미터·규격 → API 변경", () => {
    expect(classify("[A] 필수 파라미터 적용 관련 안내").type).toBe("API 변경");
  });

  it("신규·추가 → 신규/추가", () => {
    expect(classify("[A] 신규 데이터 오픈 안내").type).toBe("신규/추가");
  });

  it("해당 없음 → 기타", () => {
    expect(classify("[A] 담당자 연락처 안내").type).toBe("기타");
  });

  it("제목으로 못 정하면 본문으로 분류한다", () => {
    expect(classify("[A] 안내드립니다", "서버 점검 예정").type).toBe("일시 중단(점검)");
  });

  // 실제 수집된 공지 제목·본문 일부로 회귀 테스트
  it.each([
    ["[한국문화정보원] 문화동영상 외 1종 Open API 제공중단 안내", "제공중단 사유 : 시스템 개편에 따른 서비스 중단", "제공 중단/종료"],
    ["[한국토지주택공사] LH청약플러스 시스템 점검 작업으로 인한 서비스 일시 중단 안내 (수정)", "", "일시 중단(점검)"],
    ["[행정안전부] 공공데이터 제공표준 조회 서비스 OPEN API 서비스 변경안내", "ㅁ변경 후 URL : 제공표준정보상세조회 : https://apis.data.go.kr/1741000/prvdstd30/retrievePrvdStdInfoV2 기존 서비스 URL은 90일 유지 후 중단됩니다.", "URL 변경"],
    ["[금융위원회] 단기금융증권발행정보 Open API 서비스 일부 기능별 필수 파라미터 적용 관련 안내", "", "API 변경"],
    ["[외교부] 광주센터 커널 패치 작업으로 인한 Open APl 서비스 순단 안내", "", "일시 중단(점검)"],
  ])("실제 공지: %s", (title, body, type) => {
    expect(classify(title, body).type).toBe(type);
  });
});
