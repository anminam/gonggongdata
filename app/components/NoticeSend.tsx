"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { DeliverResult } from "@/lib/run";
import type { Ctx, Notice } from "./shared";

type Recipient = { user_id: string; email: string; gd_recipients: { email: string }[] };
const MAX_USERS = 50;

/** 공지 상세에서만 불러오는 관리자 지정 발송 패널. 실제 발송 권한은 API에서 다시 검사한다. */
export default function NoticeSend({ ctx, notice }: { ctx: Ctx; notice: Notice }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="space-y-3 rounded-lg border p-4" aria-label="관리자 공지 발송">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">사용자에게 공지 발송</h3>
        <p className="text-xs text-muted-foreground">알림 조건과 관계없이 이 공지 한 건을 메일로 보내요. 이미 보낸 공지도 다시 발송돼요.</p>
      </div>
      {expanded ? <RecipientPicker ctx={ctx} notice={notice} /> : (
        <Button size="sm" variant="outline" onClick={() => setExpanded(true)}><Send /> 받는 사용자 선택</Button>
      )}
    </section>
  );
}

function RecipientPicker({ ctx, notice }: { ctx: Ctx; notice: Notice }) {
  const { supabase } = ctx;
  const [users, setUsers] = useState<Recipient[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<DeliverResult[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError("");
    setUsers(null);
    (async () => {
      try {
        const { data, error } = await supabase.from("gd_profiles")
          .select("user_id, email, gd_recipients(email)")
          .eq("status", "approved").order("email");
        if (error) throw error;
        if (!cancelled) setUsers((data ?? []) as Recipient[]);
      } catch {
        if (!cancelled) setLoadError("사용자 목록을 불러오지 못했어요.");
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, reload]);

  const term = q.trim().toLowerCase();
  const visible = (users ?? []).filter((u) => [u.email, ...u.gd_recipients.map((r) => r.email)].some((email) => email.toLowerCase().includes(term)));
  const selected = (users ?? []).filter((u) => picked.has(u.user_id));

  const send = async () => {
    if (inFlight.current || !selected.length) return;
    inFlight.current = true;
    setSending(true);
    setError("");
    setResults(null);
    try {
      const res = await fetch("/api/admin/send-notice", {
        method: "POST",
        headers: { Authorization: `Bearer ${ctx.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ notice_id: notice.notice_id, user_ids: selected.map((u) => u.user_id) }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setError(j?.error ?? (res.status === 403 ? "관리자 권한을 확인해 주세요. 다시 로그인해야 할 수 있어요." : "발송 요청에 실패했어요. 발송 이력을 확인해 주세요."));
        return;
      }
      // 발송 직전 승인이 취소된 사용자도 결과에서 빠뜨리지 않는다.
      const reported = new Map<string, DeliverResult>((j.results as DeliverResult[]).map((r) => [r.user_id, r]));
      setResults(selected.map((u) => reported.get(u.user_id) ?? {
        user_id: u.user_id, email: u.email, status: "skipped", count: 0, reason: "발송 대상에서 제외됐어요. 승인 상태를 확인해 주세요.",
      }));
      setPicked(new Set());
      setConfirm(false);
    } catch {
      setError("발송 결과를 확인하지 못했어요. 중복 발송을 피하려면 발송 이력을 먼저 확인해 주세요.");
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  if (loadError) return <div role="alert" className="space-y-2 text-sm"><p>{loadError}</p><Button size="sm" variant="outline" onClick={() => setReload((v) => v + 1)}>다시 불러오기</Button></div>;
  if (users === null) return <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> 사용자 불러오는 중…</p>;
  if (!users.length) return <p className="text-sm text-muted-foreground">승인된 사용자가 없어요.</p>;

  return (
    <div className="space-y-3" aria-busy={sending}>
      {confirm ? (
        <div className="space-y-3 rounded-md bg-muted/50 p-3">
          <p className="text-sm font-medium">다음 {selected.length}명에게 이 공지를 보낼까요?</p>
          <p className="break-words text-sm">{notice.title}</p>
          <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
            {selected.map((u) => <li key={u.user_id} className="break-all"><span className="font-medium">{u.email}</span><br />받는 곳: {u.gd_recipients.map((r) => r.email).join(", ")}</li>)}
          </ul>
          <p className="text-xs text-muted-foreground">사용자의 알림 꺼짐 설정과 관계없이 발송해요.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={send} disabled={sending}>{sending ? <Spinner /> : <Send />}{sending ? "발송 중…" : "지금 발송"}</Button>
            <Button size="sm" variant="outline" onClick={() => { setConfirm(false); setError(""); }} disabled={sending}>선택 수정</Button>
          </div>
        </div>
      ) : (
        <>
          <Input aria-label="받는 사용자 검색" placeholder="계정 또는 수신 이메일로 검색" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="max-h-60 divide-y overflow-y-auto rounded-md border">
            {visible.map((u) => (
              <label key={u.user_id} className="flex cursor-pointer items-start gap-3 p-3 text-sm">
                <Checkbox className="mt-0.5" checked={picked.has(u.user_id)} disabled={!u.gd_recipients.length || (!picked.has(u.user_id) && picked.size >= MAX_USERS)} onCheckedChange={(checked) => {
                  setPicked((prev) => {
                    const next = new Set(prev);
                    if (checked === true && next.size < MAX_USERS) next.add(u.user_id);
                    else next.delete(u.user_id);
                    return next;
                  });
                }} />
                <span className="min-w-0 space-y-1 break-all">
                  <span className="block font-medium">{u.email || "이메일 인증 전"}</span>
                  <span className="block text-xs text-muted-foreground">{u.gd_recipients.length ? `받는 곳: ${u.gd_recipients.map((r) => r.email).join(", ")}` : "수신 주소가 없어 발송할 수 없어요"}</span>
                </span>
              </label>
            ))}
            {!visible.length && <p className="p-3 text-sm text-muted-foreground">검색 결과가 없어요.</p>}
          </div>
          <p className="text-xs text-muted-foreground">{picked.size}명 선택 · 한 번에 최대 {MAX_USERS}명</p>
          <Button size="sm" disabled={!picked.size} onClick={() => { setResults(null); setError(""); setConfirm(true); }}><Send /> 선택한 사용자에게 발송</Button>
        </>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {results && (
        <div role="status" className="space-y-2 rounded-md bg-muted/50 p-3 text-sm">
          <p className="font-medium">발송 {results.filter((r) => r.status === "sent").length}명 · 미발송 {results.filter((r) => r.status !== "sent").length}명</p>
          <ul className="space-y-1 text-xs">
            {results.map((r) => <li key={r.user_id} className="break-all">{r.email}: {r.status === "sent" ? "발송 완료" : r.reason || "미발송"}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
