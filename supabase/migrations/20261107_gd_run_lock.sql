-- 크롤링·발송 동시 실행 막기: 'running' 상태 기록은 한 번에 하나만 있을 수 있다.
-- (Vercel Cron과 관리자 '지금 실행'이 겹치면 나중 것은 insert가 23505로 실패해 "이미 실행 중"으로 끝난다)
-- 시간 초과로 'running'에 멈춘 기록은 lib/run.ts가 3분 뒤 error로 바꿔 잠금을 푼다.
create unique index if not exists gd_run_logs_one_running
  on public.gd_run_logs (status)
  where status = 'running';
