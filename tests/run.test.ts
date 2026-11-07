import { describe, expect, it, vi } from "vitest";
import type { ListItem } from "@/lib/crawler";
import { collectFreshNotices, MAX_PAGES, toRule } from "@/lib/run";

const item = (id: number): ListItem => ({
  notice_id: `N${id}`, seq_no: id, org: "o", title: "t", api_names: "", registered_at: "2026-11-05", url: "u",
});
/** from번부터 내림차순 n건 (data.go.kr 목록처럼 최신순) */
const page = (from: number, n = 30) => Array.from({ length: n }, (_, i) => item(from - i));

/** gd_notices에서 "이미 저장된 공지" 조회만 흉내 내는 가짜 DB */
function fakeDb(known: string[]) {
  const set = new Set(known);
  return {
    from: () => ({
      select: () => ({
        in: async (_col: string, ids: string[]) => ({ data: ids.filter((x) => set.has(x)).map((notice_id) => ({ notice_id })), error: null }),
      }),
    }),
  } as unknown as Parameters<typeof collectFreshNotices>[0];
}

describe("collectFreshNotices: 여러 페이지 크롤링", () => {
  it("1페이지에 아는 공지가 있으면 1페이지만 읽는다", async () => {
    const fetchPage = vi.fn(async (p = 1) => ({ 1: page(100), 2: page(70) } as Record<number, ListItem[]>)[p] ?? []);
    const r = await collectFreshNotices(fakeDb(["N95"]), fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(r.fresh).toHaveLength(29);
  });

  it("1페이지가 전부 새것이면 다음 페이지도 읽는다", async () => {
    const fetchPage = vi.fn(async (p = 1) => ({ 1: page(100), 2: page(70), 3: page(40) } as Record<number, ListItem[]>)[p] ?? []);
    const r = await collectFreshNotices(fakeDb(["N60"]), fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(r.fresh).toHaveLength(59);
  });

  it(`최대 ${MAX_PAGES}페이지까지만 읽는다`, async () => {
    const fetchPage = vi.fn(async (p = 1) => page(1000 - (p - 1) * 30));
    const r = await collectFreshNotices(fakeDb([]), fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(MAX_PAGES);
    expect(r.fresh).toHaveLength(MAX_PAGES * 30);
  });

  it("마지막 페이지(30건 미만)면 멈춘다", async () => {
    const fetchPage = vi.fn(async (p = 1) => ({ 1: page(100), 2: page(70, 12) } as Record<number, ListItem[]>)[p] ?? []);
    const r = await collectFreshNotices(fakeDb([]), fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(r.fresh).toHaveLength(42);
  });

  it("새 공지로 페이지가 밀려 생긴 중복을 걸러낸다", async () => {
    const fetchPage = vi.fn(async (p = 1) => ({ 1: page(100), 2: page(71), 3: page(41) } as Record<number, ListItem[]>)[p] ?? []);
    const r = await collectFreshNotices(fakeDb([]), fetchPage);
    const ids = r.fresh.map((i) => i.notice_id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("toRule: 사용자 설정 → 알림 조건", () => {
  it("설정이 없으면 본문 검사 끔·모든 유형·모든 공지 받기 끔", () => {
    expect(toRule(["a"], ["b"], null)).toEqual({ keywords: ["a"], orgs: ["b"], searchBody: false, types: null, all: false });
  });
  it("receive_all을 반영한다", () => {
    expect(toRule([], [], { receive_all: true })).toMatchObject({ all: true });
  });
  it("notify_types와 search_body를 반영한다", () => {
    expect(toRule([], [], { search_body: true, notify_types: ["URL 변경"] })).toMatchObject({ searchBody: true, types: ["URL 변경"] });
  });
});
