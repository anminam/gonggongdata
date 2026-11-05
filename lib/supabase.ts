import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** 브라우저용 (RLS 적용) */
export function browserClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/** 서버 전용 (service role, RLS 우회) — 절대 클라이언트로 보내지 말 것 */
export function adminClient() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Authorization: Bearer <access_token> 로 호출자 확인 */
export async function userFromRequest(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const db = adminClient();
  const { data } = await db.auth.getUser(token);
  if (!data.user) return null;
  const { data: profile } = await db.from("gd_profiles").select("*").eq("user_id", data.user.id).maybeSingle();
  return profile as { user_id: string; email: string; status: string; is_admin: boolean } | null;
}
