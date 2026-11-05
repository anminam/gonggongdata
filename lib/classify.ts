export type Classified = { type: string; impact: string; action: string; newUrl?: string };

type Rule = { test: RegExp; type: string; impact: string; action: string };

// 순서 중요: 점검성 '일시 중단'이 '중단'보다 먼저 잡혀야 함
const RULES: Rule[] = [
  {
    test: /점검|정전|순단|패치|이용\s*불가|일시\s*중단|작업으로/,
    type: "일시 중단(점검)",
    impact: "점검 시간 동안 API 이용 불가",
    action: "해당 시간대 장애 모니터링",
  },
  {
    test: /제공\s*중단|서비스\s*중단|제공\s*종료|서비스\s*종료|폐기|폐지|중단\s*안내|종료\s*안내/,
    type: "제공 중단/종료",
    impact: "기존 API 제공 종료 예정",
    action: "대체 API 전환 검토 필요",
  },
  {
    test: /URL\s*변경|주소\s*변경|도메인\s*변경|엔드포인트/i,
    type: "URL 변경",
    impact: "기존 URL 제공 종료 예정",
    action: "신규 URL 전환 검토 필요",
  },
  {
    test: /변경|개편|전환|버전|파라미터|필수|규격/,
    type: "API 변경",
    impact: "요청/응답 규격 변경",
    action: "변경 내용 확인 및 연동 수정 검토 필요",
  },
  {
    test: /신규|추가|오픈|개방/,
    type: "신규/추가",
    impact: "신규 기능 또는 데이터 제공",
    action: "활용 여부 검토",
  },
];

export function classify(title: string, body = ""): Classified {
  const rule = RULES.find((r) => r.test.test(title)) ?? RULES.find((r) => r.test.test(body));
  const out: Classified = rule
    ? { type: rule.type, impact: rule.impact, action: rule.action }
    : { type: "기타", impact: "공지 내용 확인 필요", action: "원문 확인" };

  // 본문에 '변경 후 URL'이 있으면 URL 변경으로 구체화
  const urlMatch = body.match(/변경\s*후\s*URL[^h]{0,30}(https?:\/\/[^\s,)]+)/i);
  if (urlMatch) {
    out.newUrl = urlMatch[1];
    if (out.type === "API 변경") {
      out.type = "URL 변경";
      out.impact = "기존 URL 제공 종료 예정";
      out.action = "신규 URL 전환 검토 필요";
    }
  }
  // "기존 서비스 URL은 90일 유지 후 중단" 같은 기간 정보 덧붙이기
  const keep = body.match(/(\d+)\s*일\s*(?:간\s*)?(?:유지|병행)/);
  if (keep) out.impact += ` (기존 ${keep[1]}일 유지 후 중단)`;
  return out;
}
