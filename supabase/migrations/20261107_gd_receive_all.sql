-- 모든 공지 받기: 켜면 키워드·구독 기관이 없어도 새 공지를 전부 받는다 (받을 유형 거르기는 그대로 적용)
-- anminam-edu 프로젝트에 적용 (gd_receive_all)
-- gd_user_settings 의 기존 RLS(본인 줄만 읽고 고치기)가 그대로 적용된다.
alter table public.gd_user_settings
  add column if not exists receive_all boolean not null default false;
