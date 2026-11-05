"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Clock, Inbox, MailCheck, Search, Send } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const all = scope === "all";

  useEffect(() => {
    setRows(null);
    let query = supabase
      .from("gd_deliveries")
      .select("id, user_id, notice_id, matched_keywords, recipients, sent_at, gd_notices(title, url, notice_type, org)")
      .order("sent_at", { ascending: false })
      .limit(500);
    if (!all) query = query.eq("user_id", profile.user_id);
    query.then(({ data }) => setRows((data ?? []) as unknown as Delivery[]));
  }, [supabase, profile.user_id, all]);

  useEffect(() => {
    if (!all) return;
    supabase.from("gd_profiles").select("user_id, email").then(({ data }) => setEmails(new Map((data ?? []).map((p) => [p.user_id, p.email]))));
  }, [supabase, all]);

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
        description="키워드에 걸려 메일로 보낸 공지 기록이에요. 테스트 메일은 기록되지 않아요."
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={MailCheck} label="보낸 공지" value={rows ? rows.length : "…"} hint="최근 500건 기준" />
        <StatCard icon={Send} label="보낸 메일" value={rows ? mailCount : "…"} hint="같은 날 공지는 1통으로 묶어 보내요" />
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
          {rows === null ? (
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
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[160px] pl-4">발송 시각</TableHead>
                  <TableHead>공지</TableHead>
                  <TableHead className="w-[170px]">매칭 키워드</TableHead>
                  <TableHead className="hidden w-[220px] pr-4 md:table-cell">{all ? "사용자 · 수신처" : "수신처"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-4 align-top tabular-nums text-muted-foreground">{fmtDateTime(r.sent_at)}</TableCell>
                    <TableCell className="max-w-0 whitespace-normal">
                      {r.gd_notices ? (
                        <a href={r.gd_notices.url} target="_blank" rel="noreferrer" className="font-medium leading-snug hover:underline">{r.gd_notices.title}</a>
                      ) : (
                        <span className="font-medium">{r.notice_id}</span>
                      )}
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <TypeBadge type={r.gd_notices?.notice_type ?? null} /> {r.gd_notices?.org}
                      </div>
                    </TableCell>
                    <TableCell className="align-top whitespace-normal"><Kw list={r.matched_keywords} /></TableCell>
                    <TableCell className="hidden pr-4 align-top text-xs whitespace-normal text-muted-foreground md:table-cell">
                      {all && <div className="text-sm font-medium text-foreground">{emails.get(r.user_id) ?? "알 수 없음"}</div>}
                      {(r.recipients ?? []).join(", ") || "-"}
                    </TableCell>
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
