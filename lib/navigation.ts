export const PAGES = ["overview", "notices", "alerts", "history", "admin", "settings"] as const;
export type Page = typeof PAGES[number];
export type NoticeFilter = { type?: string; mine?: boolean };
export type Navigation = {
  page: Page;
  filter: NoticeFilter;
  noticeId?: string;
  overlay?: "menu" | "avatar";
};

/** OAuth 응답의 hash 등 앱 경로가 아닌 값은 해석하지 않는다. */
export function parseNavigation(hash: string): Navigation {
  const [path, query] = hash.startsWith("#/") ? hash.slice(2).split("?") : [];
  const page = PAGES.find((p) => p === path) ?? "overview";
  const params = new URLSearchParams(query);
  const overlay = params.get("overlay");
  return {
    page,
    filter: page === "notices" ? {
      ...(params.get("type") ? { type: params.get("type")! } : {}),
      ...(params.get("mine") === "1" ? { mine: true } : {}),
    } : {},
    ...(page === "notices" && params.get("notice") ? { noticeId: params.get("notice")! } : {}),
    ...(overlay === "menu" || overlay === "avatar" ? { overlay } : {}),
  };
}

export function navigationHash(route: Navigation): string {
  const params = new URLSearchParams();
  if (route.page === "notices") {
    if (route.filter.type) params.set("type", route.filter.type);
    if (route.filter.mine) params.set("mine", "1");
    if (route.noticeId) params.set("notice", route.noticeId);
  }
  if (route.overlay) params.set("overlay", route.overlay);
  return `#/${route.page}${params.size ? `?${params}` : ""}`;
}

const EVENT = "gd:navigation";
const STATE_KEY = "gdNavigation";

export function subscribeNavigation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener("hashchange", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}
export const navigationSnapshot = () => window.location.hash;
export const serverNavigationSnapshot = () => "";

function writeNavigation(route: Navigation, replace: boolean, returnTo?: string) {
  const hash = navigationHash(route);
  // Next.js의 history 상태와 다른 기능이 저장한 값을 보존한다.
  const state = { ...window.history.state, [STATE_KEY]: returnTo ? { returnTo } : null };
  window.history[replace ? "replaceState" : "pushState"](state, "", hash);
  window.dispatchEvent(new Event(EVENT));
}

/** 같은 메뉴를 다시 눌러 불필요한 뒤로가기 단계를 만들지 않는다. */
export function navigate(route: Navigation) {
  const current = parseNavigation(window.location.hash);
  const hash = navigationHash(route);
  if (hash === navigationHash(current)) return;
  if (current.overlay && hash === navigationHash({ ...current, overlay: undefined })) {
    dismissNavigation(route);
    return;
  }
  // 모바일 메뉴에서 선택한 화면으로 이동할 때 메뉴 기록을 새 화면으로 대체한다.
  const returnTo = current.overlay
    ? window.history.state?.[STATE_KEY]?.returnTo
    : navigationHash(current);
  writeNavigation(route, !!current.overlay, returnTo);
}

export function openNotice(noticeId: string) {
  const current = parseNavigation(window.location.hash);
  const base = { ...current, page: "notices" as const, overlay: undefined, noticeId: undefined };
  if (current.noticeId === noticeId && current.page === "notices") return;
  writeNavigation({ ...base, noticeId }, !!current.noticeId, navigationHash(base));
}

export function openNavigationOverlay(overlay: "menu" | "avatar") {
  const current = parseNavigation(window.location.hash);
  if (current.overlay === overlay) return;
  writeNavigation({ ...current, overlay }, !!current.overlay, navigationHash({ ...current, overlay: undefined }));
}

/** 직접 연 링크에는 돌아갈 앱 기록이 없으므로 닫을 때 같은 화면의 기본 URL로 대체한다. */
export function dismissNavigation(base: Navigation) {
  if (window.history.state?.[STATE_KEY]?.returnTo === navigationHash(base)) window.history.back();
  else writeNavigation(base, true);
}

export function closeNotice() {
  const current = parseNavigation(window.location.hash);
  if (current.noticeId) dismissNavigation({ ...current, noticeId: undefined });
}
export function closeNavigationOverlay() {
  const current = parseNavigation(window.location.hash);
  if (current.overlay) dismissNavigation({ ...current, overlay: undefined });
}
export function goBack() {
  if (window.history.state?.[STATE_KEY]?.returnTo) window.history.back();
  else writeNavigation({ page: "overview", filter: {} }, true);
}
