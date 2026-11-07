// 서버(발송)와 화면(미리보기)이 같은 규칙으로 매칭하도록 공용으로 둔다.
export type MatchableNotice = {
  title: string;
  api_names: string | null;
  org: string | null;
  body?: string | null;
  notice_type?: string | null;
};

/** 공지 유형 (lib/classify.ts 의 분류 결과와 같은 이름) */
export const NOTICE_TYPES = ["제공 중단/종료", "URL 변경", "API 변경", "일시 중단(점검)", "신규/추가", "기타"] as const;

export function matchKeywords(n: MatchableNotice, keywords: string[], searchBody: boolean) {
  const hay = [n.title, n.api_names, n.org, searchBody ? n.body : ""].join(" ").toLowerCase();
  return keywords.filter((k) => hay.includes(k.toLowerCase()));
}

export type AlertRule = {
  keywords: string[];
  /** 구독한 기관 (공지 기관명과 정확히 같아야 함) */
  orgs: string[];
  searchBody: boolean;
  /** 받을 유형. null/undefined = 모든 유형 */
  types?: string[] | null;
  /** 모든 공지 받기: 키워드·기관과 상관없이 전부 걸림 (받을 유형 거르기는 적용) */
  all?: boolean;
};

export const ORG_PREFIX = "기관:";
/** '모든 공지 받기'로 걸렸을 때의 이유 */
export const ALL_REASON = "전체 공지";

/** 받을 유형인지 */
export function typeAllowed(n: MatchableNotice, types?: string[] | null) {
  return !types || types.includes(n.notice_type || "기타");
}

/**
 * 공지가 알림 조건에 걸리면 이유(키워드, "기관:OO")를 돌려주고, 아니면 빈 배열.
 * 키워드 OR 구독 기관 중 하나라도 걸리고(또는 '모든 공지 받기'), 받기로 한 유형이어야 한다.
 */
export function matchNotice(n: MatchableNotice, rule: AlertRule) {
  if (!typeAllowed(n, rule.types)) return [];
  const hits = matchKeywords(n, rule.keywords, rule.searchBody);
  if (n.org && rule.orgs.includes(n.org)) hits.push(`${ORG_PREFIX}${n.org}`);
  // 키워드·기관으로도 걸렸으면 그 이유를 보여 주고, 아니면 '전체 공지'
  if (rule.all && !hits.length) hits.push(ALL_REASON);
  return hits;
}

/** 조건이 하나도 없으면(키워드·기관 없음, 모든 공지 받기 꺼짐) 알림을 보내지 않는다 */
export const hasAnyRule = (rule: AlertRule) => !!rule.all || rule.keywords.length > 0 || rule.orgs.length > 0;
