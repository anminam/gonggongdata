# 관리자 설정 확장 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 설정 화면의 "관리자 설정" 영역에서 ① 알림 메일 자동 발송 일시정지 ② 가입 승인 방식 ③ 알림 메일 제목 양식을 바꿀 수 있게 한다.

**Architecture:** 한 줄짜리 설정 테이블 `gd_app_settings`(id=1)에 세 설정을 모은다. 이 테이블은 RLS로 관리자만 읽고 쓴다. 서버(크론·발송)는 service role로 읽는다. 가입 승인은 이미 있는 DB 트리거 `gd_profiles_before_insert`를 확장해서 결정한다. 제목은 `renderEmail`에 양식 인자를 더해 처리한다.

**Tech Stack:** Next.js 15 (App Router), Supabase(Postgres, RLS), vitest, shadcn/ui, sonner(toast)

**Spec:** `docs/superpowers/specs/2026-11-06-gonggongdata-service-design.md` (11장. 원래 문서 admin-settings-design.md는 이 문서에 합쳐짐)

## 확인된 현재 상태 (2026-11-06, Supabase `anminam-edu` 프로젝트 `jucqpfazhlrnrohkfiyg` 직접 조회)

- `gd_profiles` 컬럼: `user_id uuid`, `email text`, `status text default 'pending'`, `is_admin bool default false`, `created_at`, `approved_at`
- RLS: insert는 `user_id = auth.uid()`, select는 본인 또는 `gd_is_admin()`, update는 `gd_is_admin()`만
- `gd_profiles_before_insert()`(BEFORE INSERT, security definer)가 **이미** 두 가지를 한다.
  - `auth.users` 이메일로 `new.email`을 덮어쓴다. 그래서 스펙의 "이메일 덮어쓰기" 요구는 이미 충족돼 있다.
  - status, is_admin, approved_at을 강제한다. `minamhunmin@gmail.com`이면 관리자로 승인하고, 그 외는 pending으로 둔다.
- `gd_is_admin()`: `exists (select 1 from gd_profiles where user_id = auth.uid() and is_admin and status = 'approved')`
- `gd_run_logs` 컬럼: `id, started_at, finished_at, status, new_notices, emails_sent, error`
- `renderEmail` 호출처: `lib/run.ts`의 `deliverToUser`, `testSendToUsers`, `deliverNotice` 세 곳과 `app/api/me/test-send/route.ts`

## Global Constraints

- 새 테이블에는 반드시 RLS를 켠다. 읽기·쓰기 정책은 `public.gd_is_admin()`만 허용한다 (CLAUDE.md 보안 2번).
- 승인 판단은 DB 트리거에서만 한다. 브라우저가 보낸 status, is_admin, approved_at, email은 무시한다.
- 기존 관리자 고정 규칙(`minamhunmin@gmail.com` → 관리자·승인)은 그대로 둔다. 이 규칙이 승인 방식보다 먼저 적용된다.
- 기본 제목: `🚨 공공데이터 API 변경공지 감지 {건수}건 ({날짜})` — 지금 제목과 같아야 한다.
- 칸은 `{건수}`, `{날짜}` 두 개만 쓴다. 날짜는 한국 시간 `YYYY-MM-DD`(`toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })`).
- 테스트 발송의 `[테스트] `는 코드가 앞에 붙인다.
- 제목은 줄바꿈을 공백으로 바꾸고 200자까지만 둔다.
- 도메인은 앞의 `@`와 공백을 떼고 소문자로 저장한다. 정확히 같은 도메인만 승인한다(하위 도메인 제외).
- 자동 승인은 새 가입부터만 적용한다. 거절된 사람은 프로필이 남아 있으니 다시 승인되지 않는다.
- 일시정지는 `runDaily()`(크론과 "지금 실행" 둘 다)의 발송 단계만 건너뛴다. 강제 발송, 공지 지정 발송, 테스트 발송, 내 테스트 발송은 그대로 동작한다.
- 화면 문구는 한국어로 쓰고, 파일은 UTF-8로 저장한다. 새 패키지는 설치하지 않는다.

## Review Focus

1. 설정 줄이 아예 없거나 컬럼이 null일 때 → 기본값으로 동작해야 한다 (발송 켬, 수동 승인, 기본 제목). Task 1 `loadAppSettings` 테스트로 확인한다.
2. 허용 도메인에 대문자나 `@`가 섞인 입력(`@Example.GO.kr `), 또는 가입 이메일이 대문자인 경우 → 승인돼야 한다. Task 1 `normalizeDomain` 테스트와 Task 2 SQL 검증으로 확인한다.
3. 하위 도메인으로 우회(`a@sub.example.go.kr`, `a@evil-example.go.kr`) → 승인되면 안 된다. Task 2 SQL 검증으로 확인한다.
4. 제목 양식에 칸이 여러 번 나오거나 아예 없을 때 → 모든 칸이 바뀌고, 칸이 없으면 쓴 그대로 나가야 한다. Task 1 `fillSubject` 테스트로 확인한다.
5. 일반 사용자(승인된 비관리자)가 `gd_app_settings`를 읽거나 쓰려 할 때 → 0줄이 나오거나 거부돼야 한다. Task 2 SQL 검증으로 확인한다.

---

### Task 1: 설정 모듈 (`lib/settings.ts`)

**Files:**
- Create: `lib/settings.ts`
- Test: `tests/settings.test.ts`

**Interfaces:**
- Produces:
  - `type ApprovalMode = "manual" | "domain" | "all"`
  - `type AppSettings = { mail_paused: boolean; approval_mode: ApprovalMode; approval_domains: string[]; subject_template: string | null }`
  - `const DEFAULT_SUBJECT = "🚨 공공데이터 API 변경공지 감지 {건수}건 ({날짜})"`
  - `const DEFAULT_SETTINGS: AppSettings` (`false, "manual", [], null`)
  - `fillSubject(template: string | null | undefined, count: number, date: string): string`. 공백만 있거나 비어 있으면 `DEFAULT_SUBJECT`를 쓰고, 모든 `{건수}`와 `{날짜}`를 바꾼다.
  - `cleanSubject(s: string): string`. 줄바꿈을 공백으로 바꾸고 trim한 뒤 200자에서 자른다.
  - `normalizeDomain(s: string): string | null`. trim, 앞의 `@` 제거, 소문자로 바꾼다. 비었거나 `.`이 없거나 공백·`@`가 남으면 `null`을 돌려준다.
  - `loadAppSettings(db: SupabaseClient): Promise<AppSettings>`. `gd_app_settings`의 id=1을 `maybeSingle`로 읽고, null인 필드는 기본값으로 채운다. 읽기 에러는 throw한다.
- 이 파일은 브라우저(미리보기)에서도 import하므로 서버 전용 모듈을 import하지 않는다. `SupabaseClient`는 `@supabase/supabase-js`에서 type import만 한다.

- [ ] **Step 1: 실패하는 테스트 작성** (`tests/settings.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, DEFAULT_SUBJECT, cleanSubject, fillSubject, loadAppSettings, normalizeDomain } from "@/lib/settings";

describe("fillSubject", () => {
  it("비어 있으면 기본 제목", () => {
    expect(fillSubject(null, 3, "2026-11-06")).toBe("🚨 공공데이터 API 변경공지 감지 3건 (2026-11-06)");
    expect(fillSubject("   ", 3, "2026-11-06")).toBe(fillSubject(DEFAULT_SUBJECT, 3, "2026-11-06"));
  });
  it("칸을 모두 바꾼다", () => {
    expect(fillSubject("{날짜} {건수}/{건수}", 2, "2026-11-06")).toBe("2026-11-06 2/2");
  });
  it("칸이 없으면 그대로, 모르는 칸은 글자 그대로", () => {
    expect(fillSubject("공지 알림 {기관}", 1, "2026-11-06")).toBe("공지 알림 {기관}");
  });
});

describe("cleanSubject", () => {
  it("줄바꿈을 공백으로, 200자 제한", () => {
    expect(cleanSubject(" a\r\nb\nc ")).toBe("a b c");
    expect(cleanSubject("가".repeat(250))).toHaveLength(200);
  });
});

describe("normalizeDomain", () => {
  it("@·공백 제거, 소문자", () => expect(normalizeDomain(" @Example.GO.kr ")).toBe("example.go.kr"));
  it("잘못된 입력은 null", () => {
    for (const s of ["", "  ", "nodot", "a b.kr", "x@y.kr"]) expect(normalizeDomain(s)).toBeNull();
  });
});

describe("loadAppSettings", () => {
  const db = (row: unknown) =>
    ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }) }) as never;
  it("줄이 없으면 기본값", async () => expect(await loadAppSettings(db(null))).toEqual(DEFAULT_SETTINGS));
  it("null 필드는 기본값으로 채운다", async () =>
    expect(await loadAppSettings(db({ mail_paused: true, approval_mode: null, approval_domains: null, subject_template: "x" })))
      .toEqual({ ...DEFAULT_SETTINGS, mail_paused: true, subject_template: "x" }));
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/settings.test.ts`, 예상 결과: FAIL (모듈 없음)
- [ ] **Step 3: `lib/settings.ts` 구현** — 위 Interfaces의 시그니처대로 만든다.
- [ ] **Step 4: 통과 확인** — `npx vitest run tests/settings.test.ts`, 예상 결과: PASS
- [ ] **Step 5: 커밋** — `git add lib/settings.ts tests/settings.test.ts && git commit -m "관리자 설정 모듈 추가 (제목 양식·도메인 정규화·설정 읽기)"`

---

### Task 2: DB — 설정 테이블, RLS, 가입 트리거 확장

**Files:**
- Create: `supabase/migrations/20261106_gd_app_settings.sql`
- 적용: Supabase MCP `apply_migration` (project `jucqpfazhlrnrohkfiyg`, name `gd_app_settings`)

**Interfaces:**
- Produces:
  - 테이블 `public.gd_app_settings`: `id int primary key default 1 check (id = 1)`, `mail_paused boolean not null default false`, `approval_mode text not null default 'manual' check (approval_mode in ('manual','domain','all'))`, `approval_domains text[] not null default '{}'`, `subject_template text check (subject_template is null or char_length(subject_template) <= 200)`, `updated_at timestamptz not null default now()`, `updated_by uuid references auth.users(id) on delete set null`
  - 시드 줄: `insert into public.gd_app_settings (id) values (1) on conflict do nothing;`
  - RLS 켜기와 정책 3개(select, insert, update). 셋 다 `to authenticated`에 using·with check `public.gd_is_admin()`. 그리고 `revoke all ... from anon`.
  - `gd_profiles_before_insert()` 교체: 기존 내용을 그대로 두고 else 분기만 바꾼다.

```sql
-- else 분기 (관리자 고정 규칙 다음)
select approval_mode, approval_domains into v_mode, v_domains from public.gd_app_settings where id = 1;
if coalesce(v_mode, 'manual') = 'all'
   or (v_mode = 'domain' and lower(split_part(new.email, '@', 2)) = any (
         select lower(d) from unnest(coalesce(v_domains, '{}')) d)) then
  new.status := 'approved'; new.is_admin := false; new.approved_at := now();
else
  new.status := 'pending'; new.is_admin := false; new.approved_at := null;
end if;
```

- 마이그레이션 파일 첫 줄에는 다른 파일처럼 `-- 이미 anminam-edu 프로젝트에 적용됨 (gd_app_settings)`를 적는다.

- [ ] **Step 1: 마이그레이션 파일 작성** — 위 내용. 함수 전체는 `create or replace function public.gd_profiles_before_insert()`로 쓰고, `declare`에 `v_mode text; v_domains text[];`를 더한다.
- [ ] **Step 2: 적용** — `apply_migration`. 예상 결과: 성공
- [ ] **Step 3: 확인 SQL 실행** — `execute_sql`, 한 트랜잭션 안에서 실행하고 끝에 `rollback`:
  - `gd_app_settings` 줄이 1개이고 값이 기본값인지
  - `select relrowsecurity from pg_class where oid = 'public.gd_app_settings'::regclass` → `true`
  - 승인 규칙을 함수 로직과 같은 식으로 확인한다. `approval_mode='domain'`, `approval_domains='{example.go.kr}'`로 둔다.
    - `A@Example.GO.kr` → 일치
    - `a@sub.example.go.kr` → 불일치
    - `a@evil-example.go.kr` → 불일치
  - 비관리자 접근 확인: `set local role authenticated; set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000"}'; select count(*) from gd_app_settings;` → `0`
  - 예상 결과: 모든 항목이 기대값과 같다. 실제 사용자 데이터는 만들거나 바꾸지 않는다 (rollback).
- [ ] **Step 4: 커밋** — `git add supabase/migrations/20261106_gd_app_settings.sql && git commit -m "관리자 설정 테이블(RLS)과 가입 승인 방식 트리거 추가"`

---

### Task 3: 발송 쪽 — 일시정지와 제목 양식 적용

**Files:**
- Modify: `lib/mailer.ts:24-26` (`renderEmail`)
- Modify: `lib/run.ts` (`runDaily`, `deliverToUser`, `testSendToUsers`, `resendRecent`, `deliverNotice`, `sendNoticeToUsers`)
- Modify: `app/api/me/test-send/route.ts`
- Modify: `app/components/Admin.tsx:81` ("지금 실행" 완료 토스트)
- Test: `tests/mailer.test.ts`, `tests/deliver.test.ts`, `tests/run.test.ts`

**Interfaces:**
- Consumes: Task 1의 `loadAppSettings`, `fillSubject`
- Produces:
  - `renderEmail(notices, test = false, subjectTemplate?: string | null)`. 제목은 `(test ? "[테스트] " : "") + fillSubject(subjectTemplate, notices.length, today)`
  - `deliverToUser(db, u, notices, { resend, subjectTemplate }: { resend: boolean; subjectTemplate?: string | null })`
  - `deliverNotice(db, u, n, subjectTemplate?: string | null)`
  - `runDaily()` 반환값: `{ ok: true, newNotices, emailsSent, mailPaused: boolean }`
- 양식은 각 진입 함수(`runDaily`, `testSendToUsers`, `resendRecent`, `sendNoticeToUsers`, `me/test-send` POST)에서 `loadAppSettings(db)`로 한 번만 읽어 아래로 넘긴다.
- `runDaily`의 순서: 수집·저장 → 설정 읽기 → `mail_paused`면 3단계를 건너뛴다(`emails = 0`). 실행 기록은 평소처럼 `success`로 남긴다.

- [ ] **Step 1: 실패하는 테스트 작성**
  - `tests/mailer.test.ts`: `it("양식이 있으면 그 제목을 쓴다", ...)` — `renderEmail([notice(), notice({ notice_id: "2" })], false, "알림 {건수}건").subject`가 `"알림 2건"`, `renderEmail([notice()], true, "알림").subject`가 `"[테스트] 알림"`
  - 기존 `/2건 \(\d{4}-\d{2}-\d{2}\)$/` 테스트는 양식 없이 그대로 통과해야 한다(기본 제목 유지).
  - `tests/deliver.test.ts`: `deliverToUser(db, user(), notices, { resend: false, subjectTemplate: "X {건수}" })` 후 `sendMail`의 두 번째 인자의 `subject`가 `"X 2"`
  - `tests/run.test.ts`: `describe("runDaily: 발송 일시정지")` — `vi.mock("@/lib/supabase")`로 `adminClient`가 가짜 DB를 돌려주게 하고, `vi.mock("@/lib/crawler")`로 `fetchNoticeList`가 `[]`을 돌려주게 한다. `vi.mock("@/lib/mailer")`의 `sendMail`은 스파이로 둔다. 가짜 DB의 역할:
    - `gd_run_logs`는 insert·update를 기록한다.
    - `gd_notices`는 최근 공지 1건을 돌려준다.
    - `gd_app_settings`는 `{ mail_paused: true }`를 돌려준다.
    - `gd_profiles`는 그 공지에 걸리는 사용자 1명을 돌려준다.
    - 단정: `runDaily()` 결과 `mailPaused === true`, `emailsSent === 0`, `sendMail` 호출 0회, 실행 기록 update에 `status: "success"`. 같은 가짜에서 `mail_paused: false`면 `sendMail`이 1회 불린다.
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/mailer.test.ts tests/deliver.test.ts tests/run.test.ts`, 예상 결과: 새 테스트만 FAIL
- [ ] **Step 3: 구현** — 위 Interfaces대로 바꾼다. `Admin.tsx:81`의 토스트는 `j.mailPaused`일 때 `완료: 신규 공지 N건 · 발송 일시정지 중이라 메일은 보내지 않았어요`로 바꾼다.
- [ ] **Step 4: 통과 확인** — `npm test && npm run typecheck`, 예상 결과: 전체 PASS, 타입 에러 0
- [ ] **Step 5: 커밋** — `git commit -am "자동 발송 일시정지와 메일 제목 양식 적용"`

---

### Task 4: 화면 — 관리자 설정 카드 3개

**Files:**
- Create: `app/components/AdminSettings.tsx`
- Modify: `app/components/Settings.tsx` ("관리자 설정" 영역의 grid에 카드 추가)

**Interfaces:**
- Consumes: Task 1의 `AppSettings`, `ApprovalMode`, `DEFAULT_SUBJECT`, `fillSubject`, `cleanSubject`, `normalizeDomain`, `loadAppSettings`; Task 2의 테이블과 RLS
- Produces: `export function AppSettingsCards({ ctx }: { ctx: Ctx })`. 세 카드를 Fragment로 돌려준다. `Settings.tsx`에서는 `<SenderCard ctx={ctx} selfLoad />` 옆에 `<AppSettingsCards ctx={ctx} />`를 둔다.
- 읽기는 `loadAppSettings(ctx.supabase)`로 한다. 저장은 `EnabledCard`(`app/components/Alerts.tsx:542`)와 같은 방식으로, 브라우저 클라이언트로 `gd_app_settings`를 `upsert({ id: 1, ...바뀐 필드, updated_at: new Date().toISOString(), updated_by: ctx.profile.user_id })`한다. RLS가 관리자 여부를 확인한다. 성공하면 `toast.success("설정을 저장했어요")`, 실패하면 `toast.error(\`저장 실패: ${error.message}\`)`를 띄우고 화면 값을 되돌린다.
- 카드와 문구(`SectionCard`, `Field`, `Switch`, `ToggleGroup`, `Input`, `Button`, `Badge` 사용):
  1. **알림 메일 발송**
     - Switch "자동 발송". 켜짐이 `!mail_paused`다.
     - 설명: `매일 오후 2시 수집 후 알림 메일을 보내요.`
     - 꺼져 있을 때는 경고 문구 `자동 알림 메일이 나가지 않아요. 수집은 계속돼요. 다시 켜면 최근 7일 중 못 보낸 공지가 다음 실행 때 나가요.`
  2. **가입 승인 방식**
     - ToggleGroup: `수동 승인` / `도메인 자동 승인` / `전원 자동 승인`. 누르면 바로 저장한다.
     - `domain`일 때만 도메인 목록을 보여 준다. 각 도메인은 Badge에 삭제 버튼을 달아 보여 주고, 아래에 Input과 "추가" 버튼을 둔다.
     - 추가할 때 `normalizeDomain`이 null을 돌려주면 `toast.error("도메인 형식이 아니에요 (예: example.go.kr)")`를 띄운다. 이미 있는 도메인이면 무시한다.
     - 설명: `새로 가입하는 사람부터 적용돼요.`
  3. **알림 메일 제목**
     - Input. placeholder는 `DEFAULT_SUBJECT`다. 저장 버튼을 누르면 `cleanSubject`를 거쳐 저장하고, 빈 값은 `null`로 저장한다.
     - 안내: `{건수}, {날짜} 칸을 쓸 수 있어요. 비우면 기본 제목을 써요.`
     - 미리보기: `fillSubject(입력값, 3, 오늘 KST 날짜)`. 입력할 때마다 갱신한다.

- [ ] **Step 1: `AppSettingsCards` 구현하고 `Settings.tsx`에 넣기**
- [ ] **Step 2: 타입·테스트 확인** — `npm test && npm run typecheck`, 예상 결과: PASS
- [ ] **Step 3: 화면 확인** — 개발 서버를 띄워 관리자 계정으로 설정 화면을 연다. 아래를 확인한다.
  - 카드 4개가 보인다.
  - 스위치, 승인 방식, 도메인 추가와 삭제, 제목 저장이 새로고침 뒤에도 유지된다.
  - 콘솔 에러가 없다.
  - 일반 사용자 화면에는 관리자 영역이 보이지 않는다.
  - 로그인이 필요해서 직접 확인하기 어려우면 "확인 필요"로 남긴다.
- [ ] **Step 4: 배포 전 보안 검사 후 커밋·푸시** (CLAUDE.md 5번)
  - 새 코드에 비밀 키가 없는지 본다.
  - 실제 개인정보가 테스트나 예시에 없는지 본다.
  - `gd_app_settings`의 RLS가 켜져 있는지 본다.
  - 문제가 없으면 `git commit -am "설정 화면에 관리자 설정 카드 추가 (발송 일시정지·가입 승인 방식·메일 제목)" && git push origin main`
