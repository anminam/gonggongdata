-- 가입(프로필 생성) 시 로그인 메일을 수신 주소로 자동 등록
-- 수신 주소 RLS는 승인된 사용자만 쓰기 가능해서, 가입 직후(승인 대기)에도 넣을 수 있게 트리거로 처리
create or replace function public.gd_add_default_recipient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and new.email <> '' then
    insert into public.gd_recipients (user_id, email) values (new.user_id, new.email)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function public.gd_add_default_recipient() from public, anon, authenticated;

drop trigger if exists gd_profiles_default_recipient on public.gd_profiles;
create trigger gd_profiles_default_recipient
after insert on public.gd_profiles
for each row execute function public.gd_add_default_recipient();

-- 기존 사용자 중 수신 주소가 하나도 없는 사람만 로그인 메일로 채움
insert into public.gd_recipients (user_id, email)
select p.user_id, p.email from public.gd_profiles p
where p.email is not null and p.email <> ''
  and not exists (select 1 from public.gd_recipients r where r.user_id = p.user_id)
on conflict do nothing;
