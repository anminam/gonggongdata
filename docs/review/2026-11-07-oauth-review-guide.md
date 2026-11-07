# 구글 OAuth 앱 검수 · 카카오 앱 설정 제출 안내

작성일: 2026-11-07
대상: https://gonggongdata.anminam.com

표기: **확인 필요** 는 아직 검증하지 않은 것.

---

## 0. 이번에 서비스에 추가한 것

| 항목 | 주소 / 위치 |
|---|---|
| 개인정보처리방침 | https://gonggongdata.anminam.com/privacy |
| 이용약관 | https://gonggongdata.anminam.com/terms |
| 회원 탈퇴 | 설정 화면 맨 아래 "회원 탈퇴" (관리자는 숨김), API `POST /api/me/delete` |
| 문서 링크 | 로그인 첫 화면, 설정 화면 아래 |

탈퇴는 이 서비스(`gd_`) 데이터만 지운다. Supabase 로그인 계정(`auth.users`)은 같은 프로젝트(anminam-edu)의 다른 서비스와 함께 쓰므로 지우지 않고, 방침 6번에 그렇게 적었다.

---

## 1. 구글 OAuth 앱 검수 (Google Cloud 콘솔)

### 1.1 왜 검수가 필요한가
- 일반 이용자 로그인: `openid`, `email`, `profile` → 민감하지 않은 범위. 검수 없이도 됨(단 앱 이름·로고를 동의 화면에 보이려면 **브랜드 인증** 필요).
- 관리자 Gmail 연결: `https://www.googleapis.com/auth/gmail.send` → **민감한 범위(sensitive)**. 검수 전에는 "확인되지 않은 앱" 경고가 뜨고, 이 범위를 승인한 사용자 수가 100명으로 제한된다.
- 참고: gmail.send는 "제한된 범위(restricted)"가 아니라서 외부 보안 평가(CASA)는 필요 없다. **확인 필요**(구글 정책은 바뀔 수 있으니 제출 화면에서 다시 확인).

> 대안: gmail.send는 관리자 한 명만 쓰므로, 검수 없이 "확인되지 않은 앱" 경고를 관리자가 한 번 넘기고 쓰는 것도 가능하다(앱 상태는 반드시 "프로덕션"이어야 함. "테스트" 상태면 갱신 토큰이 7일 뒤 만료된다).

### 1.2 OAuth 동의 화면(브랜딩)에 넣을 값
| 칸 | 값 |
|---|---|
| 앱 이름 | 공공데이터 API 공지 알림 |
| 사용자 지원 이메일 | minamhunmin@gmail.com |
| 앱 로고 | 120×120 PNG (`app/icon.svg`를 PNG로 변환해 올리기). 로고를 올리면 브랜드 검수가 필요해진다 |
| 애플리케이션 홈페이지 | https://gonggongdata.anminam.com |
| 개인정보처리방침 링크 | https://gonggongdata.anminam.com/privacy |
| 서비스 약관 링크 | https://gonggongdata.anminam.com/terms |
| 승인된 도메인 | anminam.com (그리고 Supabase 로그인용 `jucqpfazhlrnrohkfiyg.supabase.co`는 도메인 등록 대상이 아님 — 리디렉션 URI에만 있으면 됨) |
| 개발자 연락처 | minamhunmin@gmail.com |

### 1.3 도메인 소유 확인
- Google Search Console에서 `anminam.com` 도메인 속성을 **minamhunmin@gmail.com 계정으로** 소유 확인(DNS TXT 레코드). 검수 신청 계정과 Search Console 소유자가 같아야 한다.

### 1.4 범위 사용 이유 (영문, "Scope justification" 칸에 붙여넣기)

```
Our app sends daily email notifications about changes to Korean public data APIs (data.go.kr) to users who subscribed with keywords.
The gmail.send scope is requested only by the single administrator of the service, who connects their own Gmail account
so that notification emails and email-verification codes are sent from that account.
The app only sends emails; it never reads, modifies or deletes any messages in the mailbox.
The refresh token is stored server-side only and is never exposed to the browser.
Regular users only sign in with basic profile scopes (email, profile).
```

### 1.5 데모 영상 (YouTube 비공개 링크로 제출)
구글이 요구하는 것: 동의 화면의 앱 이름·범위가 보이고, 그 범위를 실제로 어디에 쓰는지 보여 줄 것. 영어 자막이나 설명을 넣으면 좋다.

찍을 순서 (2~3분):
1. 브라우저 주소창에 `https://gonggongdata.anminam.com` 이 보이게 첫 화면 → 개인정보처리방침 링크 눌러 보여 주기
2. 관리자로 로그인 → 설정 → 관리자 설정 → "Gmail 발송 계정 연결" 클릭
3. Google 동의 화면에서 **주소창의 client_id**가 보이게(주소창 확대) 하고, 앱 이름과 "이메일 보내기" 권한 문구를 보여 준 뒤 허용
4. 연결 완료 표시 → 관리자 화면에서 테스트 메일 보내기
5. 받은 메일함에서 알림 메일이 도착한 것 보여 주기 (보낸 사람 = 연결한 Gmail)
6. "메일을 읽지 않는다"는 설명(자막) 넣기

### 1.6 체크리스트
- [ ] 앱 게시 상태: 프로덕션
- [ ] 홈페이지가 로그인 없이 열리고 서비스 설명이 보임 (로그인 첫 화면이 그 역할)
- [ ] 홈페이지에서 개인정보처리방침 링크가 보임 ✅ (이번에 추가)
- [ ] 방침에 Google 사용자 데이터 사용·제한적 사용(Limited Use) 문구 있음 ✅
- [ ] Search Console 도메인 소유 확인
- [ ] 동의 화면의 범위 목록에 gmail.send만 추가(쓰지 않는 범위는 빼기)
- [ ] 데모 영상 업로드
- [ ] 범위 사용 이유 작성

---

## 2. 카카오 (Kakao Developers)

이메일은 꼭 받을 필요가 없다(없으면 서비스 안에서 6자리 코드로 인증). 다만 Supabase가 이메일 권한을 항상 요청해서 **개인 개발자 비즈 앱으로 전환하고 이메일을 "선택 동의"로 켜 두었다.** 동의항목 검수는 필요 없다(필수 동의가 아니므로).

### 2.0 지금 상태 (2026-11-07 설정함)
- 카카오 앱: **공공데이터 API 공지 알림 (앱 ID 1640805)**, 회사명 안미남인더하우스, 카테고리 생산성/도구, 대표 도메인 https://gonggongdata.anminam.com
- 카카오 로그인: ON
- REST API 키의 카카오 로그인 리다이렉트 URI: `https://jucqpfazhlrnrohkfiyg.supabase.co/auth/v1/callback`
- 클라이언트 시크릿: 기본 활성화(ON)
- 동의항목: 닉네임 필수 동의, 프로필 사진 선택 동의, 이메일 선택 동의(개인 개발자 비즈 앱)
- Supabase(Auth > Providers > Kakao): 새 앱 키·시크릿 입력함, "Allow users without an email" ON
- **Supabase는 카카오에 `account_email profile_image profile_nickname`을 항상 요청한다** (supabase/auth `kakao.go`에 고정, "Allow users without an email"을 켜도, `scopes`를 줘도 빠지지 않음). 그래서 이메일 항목이 "권한 없음"이면 KOE205로 막힌다.
- 해결: 앱 아이콘(`docs/review/app-icon-128.png`) 등록 → **개인 개발자 비즈 앱 전환** → 이메일 **선택 동의**. 2026-11-07 동의 화면이 정상으로 뜨는 것 확인
- 이메일은 선택이라 사용자가 거부할 수 있고, 거부하면 서비스 안에서 6자리 코드로 인증한다. 방침 1·5번에 "이메일(동의한 경우)" 적음
- 참고: IE CREW는 Supabase 로그인을 쓰지 않고 카카오 OAuth를 직접 구현해서 이메일 없이 됐던 것
- 선택: 카카오 동의항목 화면의 "개인정보 국외이전 정보 등록"(Supabase 서버가 인도라서). 방침 5번에는 이미 적어 둠

### 2.1 확인할 것
| 위치 | 값 |
|---|---|
| 앱 설정 > 앱 > 일반 > 앱 이름·아이콘 | 공공데이터 API 공지 알림, 서비스 아이콘 |
| 앱 설정 > 플랫폼 > Web 사이트 도메인 | https://gonggongdata.anminam.com |
| 카카오 로그인 > 리다이렉트 URI | `https://jucqpfazhlrnrohkfiyg.supabase.co/auth/v1/callback` |
| 카카오 로그인 > 동의항목 | 닉네임 필수, 프로필 사진·이메일 선택 |
| 앱 설정 > 앱 > 일반 > 개인정보 처리방침 URL (메뉴가 있으면) | https://gonggongdata.anminam.com/privacy |


### 2.2 방침과 맞춰야 할 점
- 개인정보처리방침 1·5번에 "카카오 회원번호, 닉네임, 프로필 사진·이메일 주소(동의한 경우)"로 적었다. 동의항목을 바꾸면 방침도 같이 고친다.

---

## 3. 남은 결정 / 확인 필요
- 구글 동의 화면 로고: `docs/review/app-icon-120.png` (120×120)
- 서버 접속 기록 보관 기간은 Vercel·Supabase 정책을 따른다고만 적음 — 정확한 일수 **확인 필요**
- 방침의 Supabase 서버 위치(인도 뭄바이, ap-south-1)는 2026-11-07 기준 프로젝트 설정에서 확인함
