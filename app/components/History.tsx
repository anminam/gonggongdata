"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Clock, ExternalLink, Inbox, MailCheck, Search, Send } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ctx, fmtDateTime, Kw, PageHeader, StatCard, TypeBadge } from "./shared";

type Delivery = {
  id: number;
  user_id: string;
  notice_id: string;
  matched_keywords: string[];
  recipients: string[] | null;
  sent_at: string;
  gd_notices: { title: string; url: string; notice_type: string | null; org: string | null } | null;
};

export default function History({ ctx }: { ctx: Ctx }) {
  const { supabase, profile } = ctx;
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [rows, setRows] = useState<Delivery[] | null>(null);
  const [emails, setEmails] = useState<Map<string, string>>(new Map());
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const all = profile.is_admin && scope === "all";

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError("");
    let query = supabase
      .from("gd_deliveries")
      .select("id, user_id, notice_id, matched_keywords, recipients, sent_at, gd_notices(title, url, notice_type, org)")
      .order("sent_at", { ascending: false })
      .limit(500);
    if (!all) query = query.eq("user_id", profile.user_id);
    query.then(({ data, error }) => {
      if (cancelled) return;
      if (error) setError("발송 이력을 불러오지 못했어요. 다시 시도해 주세요.");
      else setRows((data ?? []) as unknown as Delivery[]);
    });
    return () => { cancelled = true; };
  }, [supabase, profile.user_id, all, reload]);

  useEffect(() => {
    if (!all) return;
    let cancelled = false;
    supabase.from("gd_profiles").select("user_id, email").then(({ data }) => {
      if (!cancelled) setEmails(new Map((data ?? []).map((p) => [p.user_id, p.email])));
    });
    return () => { cancelled = true; };
  }, [supabase, all, reload]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!rows || !needle) return rows ?? [];
    return rows.filter((r) =>
      [r.gd_notices?.title, r.gd_notices?.org, r.matched_keywords.join(" "), (r.recipients ?? []).join(" "), emails.get(r.user_id)]
        .join(" ").toLowerCase().includes(needle),
    );
  }, [rows, q, emails]);

  // 같은 실행(분 단위)에 나간 건은 메일 1통으로 묶여 있으므로 통 수를 따로 센다
  const mailCount = useMemo(() => new Set((rows ?? []).map((r) => `${r.user_id}|${r.sent_at.slice(0, 16)}`)).size, [rows]);
  const last = rows?.[0]?.sent_at;

  return (
    <>
      <PageHeader
        title="발송 이력"
        description="보낸 공지와 발송 당시의 실제 수신 주소를 확인해요. 테스트 메일은 기록되지 않아요."
        action={
          profile.is_admin ? (
            <Tabs value={scope} onValueChange={(v) => setScope(v as "mine" | "all")}>
              <TabsList>
                <TabsTrigger value="mine">내 이력</TabsTrigger>
                <TabsTrigger value="all">전체 사용자</TabsTrigger>
              </TabsList>
            </Tabs>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={MailCheck} label="보낸 공지" value={rows ? rows.length : "…"} hint="최근 500건 기준" />
        <StatCard icon={Send} label="보낸 메일" value={rows ? mailCount : "…"} hint="동일 사용자·발송 분 기준 추정" />
        <StatCard icon={Clock} label="마지막 발송" value={<span className="text-lg">{last ? fmtDateTime(last) : "–"}</span>} />
        <StatCard icon={CalendarClock} label="발송 시각" value={<span className="text-lg">매일 14:00</span>} hint="한국 시간" />
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <InputGroup className="max-w-md">
            <InputGroupAddon><Search /></InputGroupAddon>
            <InputGroupInput placeholder="공지 제목, 키워드, 수신 주소 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="검색" />
          </InputGroup>
        </CardHeader>
        <CardContent className="px-0">
          {error ? (
            <div role="alert" className="space-y-3 p-5 text-sm">
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={() => setReload((n) => n + 1)}>다시 불러오기</Button>
            </div>
          ) : rows === null ? (
            <div className="space-y-2 p-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !filtered.length ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
                <EmptyTitle>{rows.length ? "검색 결과가 없어요" : "아직 발송된 알림이 없어요"}</EmptyTitle>
                <EmptyDescription>{rows.length ? "다른 검색어로 찾아보세요." : "키워드에 걸린 새 공지가 생기면 매일 오후 2시에 메일로 보내고 여기에 기록돼요."}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y" aria-label="발송 기록">
              {filtered.map((r) => (
                <li key={r.id} className="min-w-0 p-4 sm:p-5">
                  <article className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)] lg:gap-6">
                    <div className="min-w-0 space-y-3">
                      <p className="text-sm tabular-nums text-muted-foreground">
                        <span className="mr-2">발송</span><time dateTime={r.sent_at}>{fmtDateTime(r.sent_at)}</time>
                      </p>
                      <h2 className="text-base font-medium leading-7 [overflow-wrap:anywhere] sm:text-lg">
                        {r.gd_notices ? (
                          <a href={r.gd_notices.url} target="_blank" rel="noreferrer" className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                            {r.gd_notices.title}<ExternalLink aria-hidden="true" className="ml-1.5 inline size-3.5 align-baseline text-muted-foreground" />
                          </a>
                        ) : r.notice_id}
                      </h2>
                      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                        <TypeBadge type={r.gd_notices?.notice_type ?? null} />
                        {r.gd_notices?.org && <span className="[overflow-wrap:anywhere]">{r.gd_notices.org}</span>}
                      </div>
                      <div className="space-y-1.5 text-sm [&_[data-slot=badge]]:h-auto [&_[data-slot=badge]]:min-h-5 [&_[data-slot=badge]]:max-w-full [&_[data-slot=badge]]:whitespace-normal [&_[data-slot=badge]]:[overflow-wrap:anywhere]">
                        <p className="text-xs text-muted-foreground">발송 이유</p>
                        {r.matched_keywords.length ? <Kw list={r.matched_keywords} /> : <p className="text-muted-foreground">기록 없음</p>}
                      </div>
                    </div>
                    <div className="min-w-0 space-y-3 rounded-lg bg-muted/50 p-3 sm:p-4">
                      {all && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">사용자 계정</p>
                          <p className="break-all text-sm">{emails.get(r.user_id) || "계정 정보 확인 불가"}</p>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <h3 className="flex items-center gap-1.5 text-sm font-medium"><Send aria-hidden="true" className="size-3.5 shrink-0" /> 받는 이메일</h3>
                        {r.recipients?.length ? (
                          <ul className="space-y-1 text-sm leading-6">
                            {r.recipients.map((email, i) => <li key={`${email}-${i}`} className="break-all">{email}</li>)}
                          </ul>
                        ) : <p className="text-sm text-muted-foreground">수신 주소 기록이 없어요.</p>}
                      </div>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
