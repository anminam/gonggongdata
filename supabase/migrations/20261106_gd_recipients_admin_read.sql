-- 관리자는 강제 발송 화면에서 각 사용자의 실제 수신 주소를 볼 수 있게 읽기만 허용 (쓰기는 기존대로 본인만)
drop policy if exists gd_recipients_admin_select on public.gd_recipients;
create policy gd_recipients_admin_select on public.gd_recipients
for select to authenticated
using (public.gd_is_admin());
