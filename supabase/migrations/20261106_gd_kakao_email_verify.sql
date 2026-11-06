-- 이미 anminam-edu 프로젝트에 적용됨 (gd_kakao_email_verify)
-- 카카오 로그인 지원: 이메일 없는 가입자는 6자리 코드로 이메일을 인증한다.

-- 자동 승인 판단 (가입 트리거와 이메일 인증이 함께 씀). 인증된 이메일만 넘긴다.
create or replace function public.gd_auto_approve(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p_email, '') <> '' and exists (
    select 1 from public.gd_app_settings s
    where s.id = 1 and (
      s.approval_mode = 'all'
      or (s.approval_mode = 'domain' and lower(split_part(p_email, '@', 2)) = any (
            select lower(d) from unnest(s.approval_domains) d))));
$$;
revoke execute on function public.gd_auto_approve(text) from public, anon, authenticated;

-- 가입 트리거: 브라우저가 보낸 email은 절대 쓰지 않는다(이메일 없는 카카오 가입자가 관리자 메일을 넣는 것 차단).
-- 관리자 고정 규칙은 구글 로그인에만 적용한다.
create or replace function public.gd_profiles_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_confirmed timestamptz;
  v_provider text;
begin
  select email, email_confirmed_at, raw_app_meta_data ->> 'provider'
    into v_email, v_confirmed, v_provider
    from auth.users where id = new.user_id;
  -- email 컬럼은 not null이라 인증된 이메일이 없으면 빈 문자열로 둔다
  new.email := case when v_confirmed is not null and coalesce(v_email, '') <> '' then v_email else '' end;
  if v_provider = 'google' and lower(new.email) = 'minamhunmin@gmail.com' then
    new.status := 'approved'; new.is_admin := true; new.approved_at := now();
  elsif public.gd_auto_approve(new.email) then
    new.status := 'approved'; new.is_admin := false; new.approved_at := now();
  else
    new.status := 'pending'; new.is_admin := false; new.approved_at := null;
  end if;
  return new;
end $$;

-- 인증 코드 (서버만 service role로 다룸: RLS 켜고 정책 없음)
create table if not exists public.gd_email_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  sent_at timestamptz not null,
  window_start timestamptz not null,
  window_count int not null default 1
);
alter table public.gd_email_verifications enable row level security;
revoke all on public.gd_email_verifications from anon, authenticated;

-- 인증 성공 처리: 이메일 저장 + (대기 중이면) 자동 승인 적용 + 수신 주소 등록 + 코드 삭제를 한 번에
create or replace function public.gd_set_verified_email(p_user uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auto boolean := public.gd_auto_approve(p_email);
  v_status text;
begin
  update public.gd_profiles
     set email = p_email,
         status = case when status = 'pending' and v_auto then 'approved' else status end,
         approved_at = case when status = 'pending' and v_auto then now() else approved_at end
   where user_id = p_user and coalesce(email, '') = '' and status <> 'rejected'
  returning status into v_status;
  if v_status is null then
    raise exception 'profile not eligible';
  end if;
  insert into public.gd_recipients (user_id, email) values (p_user, p_email) on conflict do nothing;
  delete from public.gd_email_verifications where user_id = p_user;
  return v_status;
end $$;
revoke execute on function public.gd_set_verified_email(uuid, text) from public, anon, authenticated;
grant execute on function public.gd_set_verified_email(uuid, text) to service_role;
