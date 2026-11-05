import { runDaily } from "@/lib/run";
import { userFromRequest } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 관리자가 웹에서 '지금 실행'
export async function POST(req: Request) {
  const me = await userFromRequest(req);
  if (!me?.is_admin || me.status !== "approved") return new Response("Forbidden", { status: 403 });
  try {
    return Response.json(await runDaily());
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
