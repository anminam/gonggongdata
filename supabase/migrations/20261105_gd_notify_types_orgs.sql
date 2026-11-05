-- 알림 받을 공지 유형 선택 + 기관 구독
-- anminam-edu 프로젝트에 적용 (gd_notify_types_orgs)

-- 1) 사용자별 받을 공지 유형. null = 모든 유형
alter table public.gd_user_settings
  add column if not exists notify_types text[];

-- 2) 기관 구독: 공지의 기관명이 정확히 같으면 알림
create table if not exists public.gd_org_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.gd_profiles(user_id) on delete cascade,
  org text not null check (length(trim(org)) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (user_id, org)
);
create index if not exists gd_org_subscriptions_user_idx on public.gd_org_subscriptions(user_id);

alter table public.gd_org_subscriptions enable row level security;

-- 승인된 본인만 자기 구독을 보고 고칠 수 있음 (키워드 정책과 같은 규칙)
drop policy if exists gd_org_subscriptions_own on public.gd_org_subscriptions;
create policy gd_org_subscriptions_own on public.gd_org_subscriptions
  for all
  using (user_id = auth.uid() and public.gd_is_approved())
  with check (user_id = auth.uid() and public.gd_is_approved());

revoke all on public.gd_org_subscriptions from anon;
