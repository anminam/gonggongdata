-- 이미 anminam-edu 프로젝트에 적용됨 (gd_mail_sender)
-- Gmail OAuth 발송 계정 (서버 service role 전용, 정책 없음 = 클라이언트 접근 불가)
create table if not exists public.gd_mail_sender (
  id int primary key default 1 check (id = 1),
  email text not null,
  refresh_token text not null,
  connected_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.gd_mail_sender enable row level security;
revoke all on public.gd_mail_sender from anon, authenticated;
