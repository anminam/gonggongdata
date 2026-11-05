# 공공데이터 API 공지 알림

공공데이터포털(data.go.kr) **API 공지사항**을 매일 14:00(KST) 크롤링해서
사용자별 키워드(OR)에 걸리는 공지를 사용자별 수신 메일로 보내는 서비스.

- 주소: https://gonggongdata.anminam.com
- 스택: Next.js (Vercel, 서울 리전 icn1) · Supabase (DB + Google 로그인) · Gmail SMTP

## 동작
1. Vercel Cron `0 5 * * *`(UTC) → `/api/cron/crawl`
2. 목록 `selectNoticeListView.do?nttApiYn=Y&pageUnit=30` 최신 30건 파싱
3. 처음 보는 공지만 상세 `selectNotice.do?originId=...` 본문 수집 → `gd_notices` 저장
4. 승인된 사용자마다 최근 7일 공지 중 키워드 매칭 & 미발송 건 → 메일 1통으로 묶어 발송 → `gd_deliveries` 기록
5. 해당 없으면 메일 안 보냄

유형/영향/조치는 `lib/classify.ts` 규칙 기반 (점검 → 중단/종료 → URL 변경 → API 변경 → 신규 → 기타).

## 로그인/승인
- Google 로그인 → `gd_profiles`에 `pending`으로 생성
- `minamhunmin@gmail.com`은 자동 관리자 승인
- 관리자 탭에서 수락/거절, '지금 크롤링 실행'

## 환경변수 (Vercel)
`.env.example` 참고: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `CRON_SECRET`

## 로컬 개발
```bash
cp .env.example .env.local   # 값 채우기
npm install
npm run dev
```
