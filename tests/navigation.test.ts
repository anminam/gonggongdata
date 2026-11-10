import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeNavigationOverlay, closeNotice, goBack, navigate, navigationHash, openNavigationOverlay,
  openNotice, parseNavigation, subscribeNavigation, type Navigation,
} from "@/lib/navigation";

const notices: Navigation = { page: "notices", filter: {} };
let entries: { hash: string; state: Record<string, unknown> | null }[];
let index: number;
let back: ReturnType<typeof vi.fn>;

beforeEach(() => {
  entries = [{ hash: "", state: { __NA: true, framework: "preserved" } }];
  index = 0;
  const events = new EventTarget();
  back = vi.fn(() => {
    if (index > 0) index--;
    events.dispatchEvent(new Event("popstate"));
  });
  vi.stubGlobal("window", {
    get location() { return { hash: entries[index].hash }; },
    history: {
      get state() { return entries[index].state; },
      pushState: (state: Record<string, unknown>, _: string, hash: string) => {
        entries.splice(index + 1);
        entries.push({ state, hash });
        index++;
      },
      replaceState: (state: Record<string, unknown>, _: string, hash: string) => { entries[index] = { state, hash }; },
      back,
    },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("앱 방문 기록", () => {
  it("한글 필터와 공지 ID를 URL에 저장하고 복원한다", () => {
    const route: Navigation = { page: "notices", filter: { type: "URL 변경", mine: true }, noticeId: "notice/a?b#c" };
    expect(parseNavigation(navigationHash(route))).toEqual(route);
  });
  it("OAuth 응답과 알 수 없는 경로는 기본 화면으로 처리한다", () => {
    expect(parseNavigation("#access_token=secret")).toEqual({ page: "overview", filter: {} });
    expect(parseNavigation("#/unknown")).toEqual({ page: "overview", filter: {} });
  });
  it("페이지가 바뀌면 불필요한 공지 필터와 ID를 해석하지 않는다", () => {
    expect(parseNavigation("#/settings?notice=123&mine=1&type=API")).toEqual({ page: "settings", filter: {} });
  });
  it("메뉴 이동은 기록을 남겨 뒤로가면 이전 화면으로 돌아간다", () => {
    navigate(notices);
    navigate({ page: "settings", filter: {} });
    goBack();
    expect(parseNavigation(window.location.hash)).toEqual(notices);
    expect(window.history.state.framework).toBe("preserved");
    expect(window.history.state.__NA).toBe(true);
  });
  it("같은 화면을 여러 번 선택해도 기록을 쌓지 않는다", () => {
    navigate(notices);
    navigate(notices);
    expect(entries).toHaveLength(2);
  });
  it("공지 닫기는 목록으로 돌아가며 앞으로가기로 다시 열 수 있는 기록을 보존한다", () => {
    navigate(notices);
    openNotice("A");
    closeNotice();
    expect(index).toBe(1);
    expect(parseNavigation(window.location.hash)).toEqual(notices);
    expect(parseNavigation(entries[index + 1].hash).noticeId).toBe("A");
    closeNotice();
    expect(back).toHaveBeenCalledTimes(1);
  });
  it("직접 연 공지 링크는 닫을 때 앱을 나가지 않고 목록으로 대체한다", () => {
    entries[0].hash = "#/notices?notice=A";
    closeNotice();
    expect(back).not.toHaveBeenCalled();
    expect(parseNavigation(window.location.hash)).toEqual(notices);
  });
  it("모바일 메뉴에서 다른 화면을 고르면 뒤로가기에 메뉴가 다시 끼어들지 않는다", () => {
    navigate(notices);
    openNavigationOverlay("menu");
    navigate({ page: "settings", filter: {} });
    goBack();
    expect(parseNavigation(window.location.hash)).toEqual(notices);
  });
  it("모바일 메뉴에서 같은 화면을 선택하면 메뉴만 닫는다", () => {
    navigate(notices);
    openNavigationOverlay("menu");
    navigate(notices);
    expect(parseNavigation(window.location.hash)).toEqual(notices);
    expect(back).toHaveBeenCalledTimes(1);
  });
  it("팝업 위에 메뉴를 열면 뒤로가기로 메뉴부터 닫힌다", () => {
    navigate(notices);
    openNotice("A");
    openNavigationOverlay("menu");
    closeNavigationOverlay();
    expect(parseNavigation(window.location.hash)).toEqual({ ...notices, noticeId: "A" });
  });
  it("메뉴에서 프로필 팝업으로 옮긴 뒤 닫으면 원래 화면으로 돌아간다", () => {
    navigate(notices);
    openNavigationOverlay("menu");
    openNavigationOverlay("avatar");
    closeNavigationOverlay();
    expect(parseNavigation(window.location.hash)).toEqual(notices);
  });
  it("직접 연 화면에서 앱 뒤로 버튼을 누르면 대시보드로 이동한다", () => {
    entries[0].hash = "#/settings";
    goBack();
    expect(parseNavigation(window.location.hash).page).toBe("overview");
    expect(back).not.toHaveBeenCalled();
  });
  it("방문 기록 변경 알림을 보내고 구독 해제 시 이벤트를 정리한다", () => {
    const changed = vi.fn();
    const unsubscribe = subscribeNavigation(changed);
    navigate(notices);
    expect(changed).toHaveBeenCalledTimes(1);
    goBack();
    expect(changed).toHaveBeenCalledTimes(2);
    unsubscribe();
    navigate(notices);
    expect(changed).toHaveBeenCalledTimes(2);
  });
});
