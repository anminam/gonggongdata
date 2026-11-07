"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Check, Clock, FileText, Mail, MailWarning, Play, RefreshCw, RotateCw, Search, Send, UserCheck, Users, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Ctx, fmtDateTime, Notice, PageHeader, Profile, SectionCard, StatCard, TypeBadge } from "./shared";

type RunLog = { id: number; started_at: string; finished_at: string | null; status: string; new_notices: number; emails_sent: number; error: string | null };
type Sender = { email: string; updated_at: string } | null;

const STATUS = {
  approved: { label: "승인됨", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
  rejected: { label: "거절됨", className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20" },
  pending: { label: "대기", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" },
};
const RUN = {
  success: { label: "성공", className: STATUS.approved.className },
  error: { label: "실패", className: STATUS.rejected.className },
  running: { label: "실행 중", className: STATUS.pending.className },
} as Record<string, { label: string; className: string }>;

export default function Admin({ ctx, onCrawled, notices }: { ctx: Ctx; onCrawled: () => void; notices: Notice[] }) {
  const { supabase, session } = ctx;
  const [users, setUsers] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [sender, setSender] = useState<Sender | undefined>(undefined);
  const [running, setRunning] = useState(false);
  const [recipients, setRecipients] = useState<Map<string, string[]>>(new Map());

  const load = useCallback(async () => {
    const [u, l, r] = await Promise.all([
      supabase.from("gd_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("gd_run_logs").select("*").order("started_at", { ascending: false }).limit(20),
      supabase.from("gd_recipients").select("user_id, email").order("id"),
    ]);
    setUsers((u.data ?? []) as Profile[]);
    setLogs((l.data ?? []) as RunLog[]);
    const m = new Map<string, string[]>();
    for (const x of (r.data ?? []) as { user_id: string; email: string }[]) m.set(x.user_id, [...(m.get(x.user_id) ?? []), x.email]);
    setRecipients(m);
  }, [supabase]);

  useEffect(() => {
    load();
    fetch("/api/admin/gmail", { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => (r.ok ? r.json() : { sender: null }))
      .then((j) => setSender(j.sender ?? null))
      .catch(() => setSender(null));
  }, [load, session]);

  const setStatus = async (u: Profile, status: Profile["status"]) => {
    const { error } = await supabase
      .from("gd_profiles")
      .update({ status, approved_at: status === "approved" ? new Date().toISOString() : null })
      .eq("user_id", u.user_id);
    if (error) toast.error(`변경 실패: ${error.message}`);
    else toast.success(`${u.email || "이메일 인증 전"} → ${STATUS[status].label}`);
    load();
  };

  const connectGmail = () => startGmailConnect(ctx);

  const runNow = async () => {
    setRunning(true);
    const id = toast.loading("크롤링 실행 중… (최대 1분)");
    try {
      const res = await fetch("/api/admin/run", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      const j = await res.json().catch(() => ({}));
      if (j.ok)
        toast.success(
          j.mailPaused
            ? `완료: 신규 공지 ${j.newNotices}건 · 발송 일시정지 중이라 메일은 보내지 않았어요`
            : `완료: 신규 공지 ${j.newNotices}건, 메일 ${j.emailsSent}통${j.failed ? ` · 실패 ${j.failed}명(실행 기록 참고)` : ""}${j.deferred ? ` · ${j.deferred}명은 다음 실행 때` : ""}`,
          { id },
        );
      else toast.error("실행 실패", { id, description: String(j.error ?? res.status) });
      load();
      onCrawled();
    } finally {
      setRunning(false);
    }
  };

  const pending = users.filter((u) => u.status === "pending");
  const approved = users.filter((u) => u.status === "approved");
  const lastRun = logs[0];

  return (
    <>
      <PageHeader
        title="관리자"
        description="사용자 승인, 메일 발송 계정, 크롤링 실행을 관리해요."
        action={
          <Button onClick={runNow} disabled={running}>
            {running ? <Spinner /> : <Play />} 지금 크롤링 실행
          </Button>
        }
      />

      {sender === null && (
        <Alert variant="destructive">
          <MailWarning />
          <AlertTitle>메일 발송 계정이 연결되지 않았어요</AlertTitle>
          <AlertDescription>
            <p>연결하기 전에는 알림 메일이 나가지 않아요.</p>
            <Button size="sm" variant="outline" className="mt-2 w-fit" onClick={connectGmail}>Gmail 발송 계정 연결</Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="승인된 사용자" value={approved.length} hint={`전체 ${users.length}명`} />
        <StatCard icon={UserCheck} label="승인 대기" value={pending.length} hint={pending.length ? "아래에서 수락·거절하세요" : "대기 없음"} />
        <StatCard
          icon={RefreshCw}
          label="마지막 실행"
          value={lastRun ? <Badge variant="outline" className={cn("h-7 px-3 text-sm", RUN[lastRun.status]?.className)}>{RUN[lastRun.status]?.label ?? lastRun.status}</Badge> : "–"}
          hint={lastRun ? fmtDateTime(lastRun.started_at) : "실행 기록 없음"}
        />
        <StatCard
          icon={Mail}
          label="발송 계정"
          value={
            <Badge variant="outline" className={cn("h-7 px-3 text-sm", sender ? STATUS.approved.className : sender === null ? STATUS.rejected.className : "")}>
              {sender === undefined ? "확인 중" : sender ? "연결됨" : "미연결"}
            </Badge>
          }
          hint={sender ? sender.email : sender === null ? "연결해야 메일이 나가요" : ""}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SenderCard ctx={ctx} sender={sender} />

        <SectionCard title={`승인 대기 (${pending.length})`} description="새로 가입한 사용자예요">
          {!pending.length ? (
            <p className="py-4 text-sm text-muted-foreground">대기 중인 요청이 없어요.</p>
          ) : (
            <ItemGroup>
              {pending.map((u, i) => (
                <div key={u.user_id}>
                  {i > 0 && <ItemSeparator />}
                  <Item size="sm">
                    <ItemMedia><Avatar className="size-8"><AvatarFallback>{(u.email[0] ?? "?").toUpperCase()}</AvatarFallback></Avatar></ItemMedia>
                    <ItemContent>
                      <ItemTitle>{u.email || "이메일 인증 전"}</ItemTitle>
                      <ItemDescription className="flex items-center gap-1"><Clock className="size-3" /> {fmtDateTime(u.created_at)}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button size="sm" onClick={() => setStatus(u, "approved")}><Check /> 수락</Button>
                      <Button size="sm" variant="outline" onClick={() => setStatus(u, "rejected")}><X /> 거절</Button>
                    </ItemActions>
                  </Item>
                </div>
              ))}
            </ItemGroup>
          )}
        </SectionCard>
      </div>

      <ResendCard ctx={ctx} users={approved} recipients={recipients} notices={notices} disabled={sender === null} onDone={load} />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>사용자</CardTitle>
          <CardDescription>전체 {users.length}명</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="pl-4">사용자</TableHead>
                <TableHead className="w-[110px]">상태</TableHead>
                <TableHead className="hidden w-[170px] md:table-cell">가입</TableHead>
                <TableHead className="w-[110px] pr-4 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8"><AvatarFallback>{(u.email[0] ?? "?").toUpperCase()}</AvatarFallback></Avatar>
                      <span className="font-medium">{u.email || "이메일 인증 전"}</span>
                      {u.is_admin && <Badge variant="secondary">관리자</Badge>}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className={STATUS[u.status].className}>{STATUS[u.status].label}</Badge></TableCell>
                  <TableCell className="hidden tabular-nums text-muted-foreground md:table-cell">{fmtDateTime(u.created_at)}</TableCell>
                  <TableCell className="pr-4 text-right">
                    {!u.is_admin && u.status === "approved" && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setStatus(u, "rejected")}><Ban /> 차단</Button>
                    )}
                    {!u.is_admin && u.status === "rejected" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(u, "approved")}><Check /> 승인</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>실행 기록</CardTitle>
          <CardDescription>최근 20회 · 매일 14:00(한국 시간) 자동 실행</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {!logs.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">아직 실행 기록이 없어요.</p>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[170px] pl-4">시작</TableHead>
                  <TableHead className="w-[100px]">결과</TableHead>
                  <TableHead className="w-[90px] text-right">신규 공지</TableHead>
                  <TableHead className="w-[80px] text-right">메일</TableHead>
                  <TableHead className="hidden pr-4 md:table-cell">오류</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="pl-4 tabular-nums text-muted-foreground">{fmtDateTime(l.started_at)}</TableCell>
                    <TableCell><Badge variant="outline" className={RUN[l.status]?.className}>{RUN[l.status]?.label ?? l.status}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{l.new_notices}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.emails_sent}</TableCell>
                    <TableCell className="hidden max-w-0 truncate pr-4 text-xs text-destructive md:table-cell">{l.error ?? ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

type ResendResult = { user_id: string; email: string; status: "sent" | "skipped"; count: number; reason?: string };
type Mode = "test" | "resend" | "notice";

const ENDPOINT: Record<Mode, string> = { test: "/api/admin/test-send", resend: "/api/admin/resend", notice: "/api/admin/send-notice" };

/** 관리자 강제 발송: 고른 사용자에게 최근 7일 걸린 공지를 다시 보내거나, 고른 공지 1건을 보낸다 */
/** 계정(로그인 메일)과 실제로 메일이 가는 수신 주소를 함께 보여준다 */
function UserLine({ email, to }: { email: string; to: string[] }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-xs text-muted-foreground">계정 {email}</span>
      {to.length ? (
        <span className="block truncate">→ 받는 곳: {to.join(", ")}</span>
      ) : (
        <span className="block truncate text-destructive">→ 수신 주소 없음 (안 보내져요)</span>
      )}
    </span>
  );
}

function ResendCard({ ctx, users, recipients, notices, disabled, onDone }: { ctx: Ctx; users: Profile[]; recipients: Map<string, string[]>; notices: Notice[]; disabled: boolean; onDone: () => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<Mode | null>(null);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<ResendResult[] | null>(null);
  const [q, setQ] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const allOn = users.length > 0 && users.every((u) => picked.has(u.user_id));
  const term = q.trim().toLowerCase();
  const found = term
    ? notices.filter((n) => [n.title, n.org, n.api_names].some((s) => s?.toLowerCase().includes(term))).slice(0, 8)
    : [];

  const toggle = (id: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const send = async (mode: Mode) => {
    setConfirm(null);
    setSending(true);
    setResults(null);
    const what = mode === "test" ? "테스트 메일을 " : mode === "notice" ? "고른 공지를 " : "다시 ";
    const id = toast.loading(`${picked.size}명에게 ${what}보내는 중…`);
    try {
      const res = await fetch(ENDPOINT[mode], {
        method: "POST",
        headers: { Authorization: `Bearer ${ctx.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: [...picked], ...(mode === "notice" ? { notice_id: notice?.notice_id } : {}) }),
      });
      const j = await res.json().catch(() => ({}));
      if (!j.ok) {
        toast.error("발송 실패", { id, description: String(j.error ?? res.status) });
        return;
      }
      const list = j.results as ResendResult[];
      const sent = list.filter((r) => r.status === "sent");
      setResults(list);
      if (sent.length) toast.success(`${sent.length}명에게 메일을 보냈어요`, { id });
      else toast.warning("보낸 메일이 없어요", { id, description: "아래 결과에서 이유를 확인하세요." });
      onDone();
    } finally {
      setSending(false);
    }
  };

  const off = disabled || sending || picked.size === 0;
  const count = picked.size ? ` (${picked.size}명)` : "";

  return (
    <SectionCard
      title="강제 발송"
      description="고른 사용자에게 최근 7일 동안 알림 조건에 걸린 공지를 다시 보내거나, 고른 공지 1건을 보내요"
      action={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => send("test")} disabled={off}>
            <Send /> 테스트 발송
          </Button>
          <Button size="sm" onClick={() => setConfirm("resend")} disabled={off}>
            {sending ? <Spinner /> : <RotateCw />} 다시 보내기{count}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {disabled && <p className="text-sm text-destructive">메일 발송 계정을 먼저 연결해야 보낼 수 있어요.</p>}

        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm font-medium"><FileText className="size-4 text-primary" /> 특정 공지 보내기</div>
          {notice ? (
            <div className="flex items-start gap-3 rounded-md bg-accent/60 p-3">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="line-clamp-2 text-sm font-medium">{notice.title}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">{notice.registered_at}</span>
                  <span>{notice.org ?? "기관 미상"}</span>
                  <TypeBadge type={notice.notice_type} />
                </div>
              </div>
              <Button size="icon" variant="ghost" aria-label="공지 선택 해제" onClick={() => setNotice(null)}><X /></Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="공지 제목·기관·API명으로 검색" aria-label="보낼 공지 검색" className="pl-8" />
              </div>
              {term && (
                <ul className="max-h-64 divide-y overflow-y-auto rounded-md border">
                  {found.map((n) => (
                    <li key={n.notice_id}>
                      <button type="button" className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/50" onClick={() => { setNotice(n); setQ(""); }}>
                        <span className="w-20 shrink-0 tabular-nums text-xs text-muted-foreground">{n.registered_at}</span>
                        <span className="flex-1 truncate">{n.title}</span>
                        <TypeBadge type={n.notice_type} className="hidden sm:inline-flex" />
                      </button>
                    </li>
                  ))}
                  {!found.length && <li className="px-3 py-3 text-sm text-muted-foreground">검색 결과가 없어요.</li>}
                </ul>
              )}
            </>
          )}
          <Button size="sm" className="w-full sm:w-auto" onClick={() => setConfirm("notice")} disabled={off || !notice}>
            <Send /> 이 공지 보내기{count}
          </Button>
        </div>

        <div className="rounded-lg border">
          <label className="flex cursor-pointer items-center gap-3 border-b bg-muted/40 px-3 py-2 text-sm font-medium">
            <Checkbox checked={allOn} onCheckedChange={(v) => setPicked(v === true ? new Set(users.map((u) => u.user_id)) : new Set())} />
            전체 선택 <span className="text-muted-foreground">({users.length}명)</span>
          </label>
          <ul className="divide-y">
            {users.map((u) => {
              const r = results?.find((x) => x.user_id === u.user_id);
              return (
                <li key={u.user_id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/40">
                    <Checkbox checked={picked.has(u.user_id)} onCheckedChange={(v) => toggle(u.user_id, v === true)} />
                    <UserLine email={u.email} to={recipients.get(u.user_id) ?? []} />
                    {r &&
                      (r.status === "sent" ? (
                        <Badge variant="outline" className={STATUS.approved.className}><Send data-icon="inline-start" />{r.count}건 보냄</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">{r.reason ?? "보내지 않음"}</Badge>
                      ))}
                  </label>
                </li>
              );
            })}
            {!users.length && <li className="px-3 py-4 text-sm text-muted-foreground">승인된 사용자가 없어요.</li>}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          각 사용자의 수신 주소로 보내요. 사용자가 ‘알림 받기’를 꺼 두었어도 보내요.
          ‘다시 보내기’는 각자의 알림 조건(키워드·구독 기관·받을 유형)대로, ‘이 공지 보내기’는 조건과 상관없이 고른 공지를 보내고 발송 이력에 남겨요.
          ‘테스트 발송’은 제목에 [테스트]가 붙고 발송 기록이 남지 않으며, 걸린 공지가 없으면 최신 1건을 샘플로 보내요.
        </p>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{picked.size}명에게 {confirm === "notice" ? "이 공지를 보낼까요?" : "다시 보낼까요?"}</DialogTitle>
            <DialogDescription>
              {confirm === "notice"
                ? `「${notice?.title ?? ""}」 공지 1건을 알림 조건과 상관없이 메일로 보내요. 보낸 메일은 되돌릴 수 없어요.`
                : "최근 7일 동안 각자의 알림 조건에 걸린 공지를, 이미 받은 공지까지 포함해 메일 1통으로 다시 보내요. 보낸 메일은 되돌릴 수 없어요."}
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {users.filter((u) => picked.has(u.user_id)).map((u) => (
              <li key={u.user_id} className="flex gap-1.5"><span className="text-muted-foreground">·</span><UserLine email={u.email} to={recipients.get(u.user_id) ?? []} /></li>
            ))}
          </ul>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">취소</Button></DialogClose>
            <Button onClick={() => confirm && send(confirm)}><Send /> 보내기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

/** 관리자: Gmail 발송 계정 연결 (Google 로그인으로 gmail.send 권한을 받는다) */
export function startGmailConnect({ supabase }: Ctx) {
  localStorage.setItem("gd_gmail_connect", "1");
  supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
      scopes: "https://www.googleapis.com/auth/gmail.send",
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
}

/** 메일 발송 계정 카드 (관리자 탭·설정 페이지 공용). selfLoad면 연결 상태를 직접 읽어 온다 */
export function SenderCard({ ctx, sender: given, selfLoad = false }: { ctx: Ctx; sender?: Sender; selfLoad?: boolean }) {
  const [own, setOwn] = useState<Sender | undefined>(undefined);
  useEffect(() => {
    if (!selfLoad) return;
    fetch("/api/admin/gmail", { headers: { Authorization: `Bearer ${ctx.session.access_token}` } })
      .then((r) => (r.ok ? r.json() : { sender: null }))
      .then((j) => setOwn(j.sender ?? null))
      .catch(() => setOwn(null));
  }, [selfLoad, ctx.session]);
  const sender = selfLoad ? own : given;
  return (
    <SectionCard
      title="메일 발송 계정"
      description="이 Gmail 계정으로 알림 메일을 보내요"
      action={<Button variant="outline" size="sm" onClick={() => startGmailConnect(ctx)}>{sender ? "다시 연결" : "연결"}</Button>}
    >
      <Item variant="muted">
        <ItemMedia variant="icon"><Mail /></ItemMedia>
        <ItemContent>
          <ItemTitle>{sender === undefined ? "확인 중…" : sender ? sender.email : "연결된 계정 없음"}</ItemTitle>
          <ItemDescription>{sender ? `연결 ${fmtDateTime(sender.updated_at)}` : "Google 로그인으로 Gmail 보내기 권한을 받아요"}</ItemDescription>
        </ItemContent>
      </Item>
    </SectionCard>
  );
}
