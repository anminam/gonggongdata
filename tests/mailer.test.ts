import { describe, expect, it } from "vitest";
import { MAIL_COLORS, renderEmail, type NoticeRow } from "@/lib/mailer";

const notice = (o: Partial<NoticeRow & { matched: string[] }> = {}) => ({
  notice_id: "1",
  org: "기상청",
  title: "[기상청] 서리발생 예측정보 OPEN API 서비스 변경안내",
  api_names: "기상청_서리발생 조회서비스",
  registered_at: "2026-11-05",
  body: "ㅁ변경 후 URL : https://apis.data.go.kr/1360000/FrstFcstInfoServiceV2 기존 URL은 90일 유지 후 중지됩니다.",
  url: "https://www.data.go.kr/bbs/ntc/selectNotice.do?originId=NOTICE_1&nttApiYn=Y",
  matched: ["서리"],
  ...o,
});

describe("renderEmail: 알림 메일", () => {
  it("테스트 메일 제목에만 [테스트]가 붙는다", () => {
    expect(renderEmail([notice()], true).subject.startsWith("[테스트]")).toBe(true);
    expect(renderEmail([notice()]).subject).not.toContain("[테스트]");
  });

  it("양식이 있으면 그 제목을 쓴다", () => {
    expect(renderEmail([notice(), notice({ notice_id: "2" })], false, "알림 {건수}건").subject).toBe("알림 2건");
    expect(renderEmail([notice()], true, "알림").subject).toBe("[테스트] 알림");
  });

  it("제목에 건수와 날짜가 들어간다", () => {
    expect(renderEmail([notice(), notice({ notice_id: "2" })]).subject).toMatch(/2건 \(\d{4}-\d{2}-\d{2}\)$/);
  });

  it("HTML 특수문자를 이스케이프한다 (스크립트 삽입 방지)", () => {
    const m = renderEmail([notice({ org: "<script>alert(1)</script>", title: "A & B <b>", matched: ["k<1>"], url: 'https://x/?a=1&b="2"' })]);
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.html).toContain("A &amp; B &lt;b&gt;");
    expect(m.html).toContain("k&lt;1&gt;");
    expect(m.html).toContain("&quot;2&quot;");
  });

  it("분류 결과(유형·조치·신규 URL)를 보여준다", () => {
    const m = renderEmail([notice()]);
    expect(m.html).toContain("URL 변경");
    expect(m.html).toContain("신규 URL 전환 검토 필요");
    expect(m.html).toContain("https://apis.data.go.kr/1360000/FrstFcstInfoServiceV2");
    expect(m.html).toContain("90일");
  });

  it("구독 기관으로 걸린 공지는 🏢 기관명으로 표시한다", () => {
    const m = renderEmail([notice({ matched: ["서리", "기관:기상청"] })]);
    expect(m.html).toContain("🏢 기상청");
    expect(m.html).not.toContain("기관:기상청");
    expect(m.text).toContain("알림 이유: 서리, 기관 기상청");
  });

  it("화면과 같은 흑백 테마 색을 쓰고 예전 파란 색은 쓰지 않는다", () => {
    const m = renderEmail([notice()]);
    expect(m.html).toContain(`background:${MAIL_COLORS.primary}`);
    expect(m.html).not.toContain("#2563eb");
  });

  it("텍스트 버전에도 핵심 정보와 링크가 있다", () => {
    const m = renderEmail([notice()]);
    expect(m.text).toContain("유형: URL 변경");
    expect(m.text).toContain("링크: https://www.data.go.kr/");
  });
});
