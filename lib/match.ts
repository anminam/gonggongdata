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
};

export const ORG_PREFIX = "기관:";

/** 받을 유형인지 */
export function typeAllowed(n: MatchableNotice, types?: string[] | null) {
  return !types || types.includes(n.notice_type || "기타");
}

/**
 * 공지가 알림 조건에 걸리면 이유(키워드, "기관:OO")를 돌려주고, 아니면 빈 배열.
 * 키워드 OR 구독 기관 중 하나라도 걸리고, 받기로 한 유형이어야 한다.
 */
export function matchNotice(n: MatchableNotice, rule: AlertRule) {
  if (!typeAllowed(n, rule.types)) return [];
  const hits = matchKeywords(n, rule.keywords, rule.searchBody);
  if (n.org && rule.orgs.includes(n.org)) hits.push(`${ORG_PREFIX}${n.org}`);
  return hits;
}

/** 조건이 하나도 없으면(키워드·기관 모두 없음) 알림을 보내지 않는다 */
export const hasAnyRule = (rule: AlertRule) => rule.keywords.length > 0 || rule.orgs.length > 0;
