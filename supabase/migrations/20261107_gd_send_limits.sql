-- 관리자 Gmail로 메일을 마구 보내지 못하게 막는 제한 두 가지
-- 1) 수신 주소는 사용자당 최대 5개 (브라우저에서 바로 넣으므로 DB에서 막는다)
-- 2) 테스트 발송 마지막 시각을 기록해 /api/me/test-send 를 10분에 1번으로 제한 (관리자 제외, 서버에서 확인)

create or replace function public.gd_recipients_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 같은 사용자의 동시 추가가 함께 통과하지 않도록 사용자별로 잠근다
  perform pg_advisory_xact_lock(hashtext('gd_recipients:' || new.user_id::text));
  if (select count(*) from public.gd_recipients where user_id = new.user_id) >= 5 then
    raise exception '수신 주소는 최대 5개까지 추가할 수 있어요' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.gd_recipients_limit() from public, anon, authenticated;

drop trigger if exists gd_recipients_limit on public.gd_recipients;
create trigger gd_recipients_limit
before insert on public.gd_recipients
for each row execute function public.gd_recipients_limit();

alter table public.gd_user_settings add column if not exists last_test_sent_at timestamptz;
