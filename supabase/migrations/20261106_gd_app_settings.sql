-- 이미 anminam-edu 프로젝트에 적용됨 (gd_app_settings)
-- 관리자 설정 한 줄(id=1): 자동 발송 일시정지, 가입 승인 방식, 알림 메일 제목 양식
create table if not exists public.gd_app_settings (
  id int primary key default 1 check (id = 1),
  mail_paused boolean not null default false,
  approval_mode text not null default 'manual' check (approval_mode in ('manual', 'domain', 'all')),
  approval_domains text[] not null default '{}',
  subject_template text check (subject_template is null or char_length(subject_template) <= 200),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.gd_app_settings (id) values (1) on conflict do nothing;

-- 관리자만 읽고 쓴다 (서버는 service role, 가입 트리거는 security definer로 읽음)
alter table public.gd_app_settings enable row level security;
revoke all on public.gd_app_settings from anon;

drop policy if exists gd_app_settings_admin_select on public.gd_app_settings;
create policy gd_app_settings_admin_select on public.gd_app_settings
for select to authenticated using (public.gd_is_admin());

drop policy if exists gd_app_settings_admin_insert on public.gd_app_settings;
create policy gd_app_settings_admin_insert on public.gd_app_settings
for insert to authenticated with check (public.gd_is_admin());

drop policy if exists gd_app_settings_admin_update on public.gd_app_settings;
create policy gd_app_settings_admin_update on public.gd_app_settings
for update to authenticated using (public.gd_is_admin()) with check (public.gd_is_admin());

-- 가입(프로필 생성) 시 승인 상태 결정: 브라우저가 보낸 email·status·is_admin·approved_at은 무시
create or replace function public.gd_profiles_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_mode text;
  v_domains text[];
begin
  select email into v_email from auth.users where id = new.user_id;
  new.email := coalesce(v_email, new.email);
  if lower(new.email) = 'minamhunmin@gmail.com' then
    new.status := 'approved'; new.is_admin := true; new.approved_at := now();
  else
    select approval_mode, approval_domains into v_mode, v_domains from public.gd_app_settings where id = 1;
    if coalesce(v_mode, 'manual') = 'all'
       or (v_mode = 'domain' and lower(split_part(new.email, '@', 2)) = any (
             select lower(d) from unnest(coalesce(v_domains, '{}')) d)) then
      new.status := 'approved'; new.is_admin := false; new.approved_at := now();
    else
      new.status := 'pending'; new.is_admin := false; new.approved_at := null;
    end if;
  end if;
  return new;
end $$;
