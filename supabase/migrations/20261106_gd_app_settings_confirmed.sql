-- 이미 anminam-edu 프로젝트에 적용됨 (gd_app_settings_confirmed)
-- 도메인 자동 승인은 확인(인증)된 이메일만 믿는다. 이메일 가입·다른 소셜 로그인에서 남의 주소로 가입해 승인받는 것을 막음
create or replace function public.gd_profiles_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_confirmed timestamptz;
  v_mode text;
  v_domains text[];
begin
  select email, email_confirmed_at into v_email, v_confirmed from auth.users where id = new.user_id;
  new.email := coalesce(v_email, new.email);
  if lower(new.email) = 'minamhunmin@gmail.com' then
    new.status := 'approved'; new.is_admin := true; new.approved_at := now();
  else
    select approval_mode, approval_domains into v_mode, v_domains from public.gd_app_settings where id = 1;
    if coalesce(v_mode, 'manual') = 'all'
       or (v_mode = 'domain' and v_confirmed is not null and lower(split_part(new.email, '@', 2)) = any (
             select lower(d) from unnest(coalesce(v_domains, '{}')) d)) then
      new.status := 'approved'; new.is_admin := false; new.approved_at := now();
    else
      new.status := 'pending'; new.is_admin := false; new.approved_at := null;
    end if;
  end if;
  return new;
end $$;
