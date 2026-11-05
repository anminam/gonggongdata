import { runDaily } from "@/lib/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron: 매일 05:00 UTC = 14:00 KST
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    return Response.json(await runDaily());
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
