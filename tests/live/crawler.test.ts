// 실제 data.go.kr 접속 테스트 — `npm run test:live` 로 실행 (읽기 전용, DB 저장·메일 발송 없음)
import { describe, expect, it } from "vitest";
import { classify } from "@/lib/classify";
import { fetchNoticeBody, fetchNoticeList, PAGE_SIZE } from "@/lib/crawler";

describe("data.go.kr API 공지 크롤러", () => {
  it("목록 1페이지를 파싱한다", async () => {
    const list = await fetchNoticeList(1);
    expect(list).toHaveLength(PAGE_SIZE);
    expect(list.every((i) => /^NOTICE_\d+$/.test(i.notice_id))).toBe(true);
    expect(new Set(list.map((i) => i.notice_id)).size).toBe(list.length);
    expect(list.every((i) => i.title && i.org)).toBe(true);
    expect(list.every((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.registered_at ?? ""))).toBe(true);
  });

  it("2페이지는 1페이지와 겹치지 않고 더 오래된 공지다", async () => {
    const [p1, p2] = await Promise.all([fetchNoticeList(1), fetchNoticeList(2)]);
    expect(p2.length).toBeGreaterThan(0);
    expect(p2.filter((i) => p1.some((j) => j.notice_id === i.notice_id))).toHaveLength(0);
    expect(p2[0].seq_no ?? 0).toBeLessThan(p1[p1.length - 1].seq_no ?? 0);
  });

  it("상세 본문을 수집하고 분류할 수 있다", async () => {
    const [first] = await fetchNoticeList(1);
    const body = await fetchNoticeBody(first.notice_id);
    expect(body.length).toBeGreaterThan(30);
    expect(body).not.toContain("목록으로 돌아가기");
    expect(classify(first.title, body).type).toBeTruthy();
  });
});
