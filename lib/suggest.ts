// 저장된 공지에서 자주 나오는 단어를 뽑아 '추천 키워드'로 보여준다.
import type { MatchableNotice } from "./match";

/** 거의 모든 공지에 나와서 키워드로 쓸모없는 말 */
const STOPWORDS = new Set([
  "open", "api", "apl", "openapi", "서비스", "안내", "공지", "변경", "변경안내", "중단", "제공", "제공중단", "일시", "일시중단",
  "순단", "점검", "작업", "시스템", "정보", "조회", "조회서비스", "관련", "수정", "수정본", "외", "건", "종", "및", "등",
  "데이터", "자료", "이용불가", "시간", "첨부파일", "조치완료", "인한", "따른", "대한", "위한", "기능", "일부", "적용", "현황",
]);

/** 조사가 붙은 말(작업으로, 점검에 등)은 키워드로 어색해서 뺀다 */
// (어린이·국가·항로·마을처럼 한 글자 조사로 끝나는 듯한 명사가 많아서, 확실한 것만 본다)
const PARTICLE_END = /(으로|에서|에게|에는|에|를)$/;

export function tokenize(text: string): string[] {
  return text
    .split(/[\s_\[\]()（）,·/\-:~'‘’"“”.]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !/^\d+$/.test(t) && !/\d/.test(t.slice(0, 1)));
}

/**
 * 공지 제목·API명·기관명에 자주 나오는 단어를 많이 나온 순으로 돌려준다.
 * 같은 공지 안에서 여러 번 나와도 1번으로 센다. 이미 추가한 키워드는 뺀다.
 */
export function suggestKeywords(notices: MatchableNotice[], existing: string[], limit = 20, minCount = 2): string[] {
  const have = new Set(existing.map((k) => k.toLowerCase()));
  const count = new Map<string, number>();
  for (const n of notices) {
    const seen = new Set<string>();
    for (const t of tokenize([n.title, n.api_names, n.org].filter(Boolean).join(" "))) {
      const key = t.toLowerCase();
      if (STOPWORDS.has(key) || PARTICLE_END.test(t) || seen.has(key)) continue;
      seen.add(key);
      count.set(t, (count.get(t) ?? 0) + 1);
    }
  }
  return [...count]
    .filter(([t, c]) => c >= minCount && !have.has(t.toLowerCase()))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .slice(0, limit)
    .map(([t]) => t);
}
