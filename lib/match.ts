// 서버(발송)와 화면(미리보기)이 같은 규칙으로 키워드를 매칭하도록 공용으로 둔다.
export type MatchableNotice = {
  title: string;
  api_names: string | null;
  org: string | null;
  body?: string | null;
};

export function matchKeywords(n: MatchableNotice, keywords: string[], searchBody: boolean) {
  const hay = [n.title, n.api_names, n.org, searchBody ? n.body : ""].join(" ").toLowerCase();
  return keywords.filter((k) => hay.includes(k.toLowerCase()));
}
