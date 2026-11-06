import type { SupabaseClient } from "@supabase/supabase-js";

// 관리자 설정(gd_app_settings, 한 줄). 브라우저 미리보기에서도 쓰므로 서버 전용 모듈은 import하지 않는다.
export type ApprovalMode = "manual" | "domain" | "all";
export type AppSettings = {
  mail_paused: boolean;
  approval_mode: ApprovalMode;
  approval_domains: string[];
  subject_template: string | null;
};

export const DEFAULT_SUBJECT = "🚨 공공데이터 API 변경공지 감지 {건수}건 ({날짜})";
export const DEFAULT_SETTINGS: AppSettings = { mail_paused: false, approval_mode: "manual", approval_domains: [], subject_template: null };

export function fillSubject(template: string | null | undefined, count: number, date: string) {
  const t = template?.trim() ? template : DEFAULT_SUBJECT;
  return t.replaceAll("{건수}", String(count)).replaceAll("{날짜}", date);
}

export const cleanSubject = (s: string) => s.replace(/\r?\n/g, " ").trim().slice(0, 200);

export function normalizeDomain(s: string) {
  const d = s.trim().replace(/^@/, "").toLowerCase();
  return d && d.includes(".") && !/[\s@]/.test(d) ? d : null;
}

// SupabaseClient<any>: 서버(service role)와 브라우저 클라이언트 둘 다 받기 위해
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadAppSettings(db: SupabaseClient<any, any, any>): Promise<AppSettings> {
  const { data, error } = await db.from("gd_app_settings").select("mail_paused, approval_mode, approval_domains, subject_template").eq("id", 1).maybeSingle();
  if (error) throw error;
  return {
    mail_paused: data?.mail_paused ?? DEFAULT_SETTINGS.mail_paused,
    approval_mode: data?.approval_mode ?? DEFAULT_SETTINGS.approval_mode,
    approval_domains: data?.approval_domains ?? DEFAULT_SETTINGS.approval_domains,
    subject_template: data?.subject_template ?? DEFAULT_SETTINGS.subject_template,
  };
}
