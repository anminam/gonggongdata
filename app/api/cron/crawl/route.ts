import { runDaily } from "@/lib/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron: 매일 05:00 UTC = 14:00 KST
export async function GET(req: Request) {
  // 비밀값이 비어 있으면 "Bearer undefined"로 통과되지 않게 무조건 거절
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    return Response.json(await runDaily());
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
