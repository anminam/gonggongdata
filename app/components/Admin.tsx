"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Check, Clock, Mail, MailWarning, Play, RefreshCw, UserCheck, Users, X } from "lucide-react";
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
import { Ctx, fmtDateTime, PageHeader, Profile, SectionCard, StatCard } from "./shared";

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

export default function Admin({ ctx, onCrawled }: { ctx: Ctx; onCrawled: () => void }) {
  const { supabase, session } = ctx;
  const [users, setUsers] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [sender, setSender] = useState<Sender | undefined>(undefined);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const [u, l] = await Promise.all([
      supabase.from("gd_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("gd_run_logs").select("*").order("started_at", { ascending: false }).limit(20),
    ]);
    setUsers((u.data ?? []) as Profile[]);
    setLogs((l.data ?? []) as RunLog[]);
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
    else toast.success(`${u.email} → ${STATUS[status].label}`);
    load();
  };

  const connectGmail = () => {
    localStorage.setItem("gd_gmail_connect", "1");
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        scopes: "https://www.googleapis.com/auth/gmail.send",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  };

  const runNow = async () => {
    setRunning(true);
    const id = toast.loading("크롤링 실행 중… (최대 1분)");
    try {
      const res = await fetch("/api/admin/run", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      const j = await res.json().catch(() => ({}));
      if (j.ok) toast.success(`완료: 신규 공지 ${j.newNotices}건, 메일 ${j.emailsSent}통`, { id });
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
        <SectionCard
          title="메일 발송 계정"
          description="이 Gmail 계정으로 알림 메일을 보내요"
          action={<Button variant="outline" size="sm" onClick={connectGmail}>{sender ? "다시 연결" : "연결"}</Button>}
        >
          <Item variant="muted">
            <ItemMedia variant="icon"><Mail /></ItemMedia>
            <ItemContent>
              <ItemTitle>{sender === undefined ? "확인 중…" : sender ? sender.email : "연결된 계정 없음"}</ItemTitle>
              <ItemDescription>{sender ? `연결 ${fmtDateTime(sender.updated_at)}` : "Google 로그인으로 Gmail 보내기 권한을 받아요"}</ItemDescription>
            </ItemContent>
          </Item>
        </SectionCard>

        <SectionCard title={`승인 대기 (${pending.length})`} description="새로 가입한 사용자예요">
          {!pending.length ? (
            <p className="py-4 text-sm text-muted-foreground">대기 중인 요청이 없어요.</p>
          ) : (
            <ItemGroup>
              {pending.map((u, i) => (
                <div key={u.user_id}>
                  {i > 0 && <ItemSeparator />}
                  <Item size="sm">
                    <ItemMedia><Avatar className="size-8"><AvatarFallback>{u.email[0].toUpperCase()}</AvatarFallback></Avatar></ItemMedia>
                    <ItemContent>
                      <ItemTitle>{u.email}</ItemTitle>
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
                      <Avatar className="size-8"><AvatarFallback>{u.email[0].toUpperCase()}</AvatarFallback></Avatar>
                      <span className="font-medium">{u.email}</span>
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
