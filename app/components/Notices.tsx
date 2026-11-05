"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FilterX, Search } from "lucide-react";
import { classify } from "@/lib/classify";
import { matchKeywords } from "@/lib/match";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { daysAgo, fmtDateTime, Kw, Notice, NOTICE_TYPES, PageHeader, TypeBadge } from "./shared";

type Period = "7" | "30" | "all";
const PAGE = 50;

export default function Notices({
  notices, keywords, searchBody, initial,
}: {
  notices: Notice[] | null; keywords: string[]; searchBody: boolean; initial: { type?: string; mine?: boolean };
}) {
  const [q, setQ] = useState("");
  const [type, setType] = useState(initial.type ?? "all");
  const [org, setOrg] = useState("all");
  const [period, setPeriod] = useState<Period>("all");
  const [mine, setMine] = useState(!!initial.mine);
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<Notice | null>(null);
  const list = notices ?? [];

  useEffect(() => setShown(PAGE), [q, type, org, period, mine]);

  const orgs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of list) if (n.org) counts.set(n.org, (counts.get(n.org) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [list]);

  const rows = useMemo(() => {
    const since = period === "all" ? "" : daysAgo(Number(period));
    const needle = q.trim().toLowerCase();
    return list
      .map((n) => ({ n, hit: keywords.length ? matchKeywords(n, keywords, searchBody) : [] }))
      .filter(({ n, hit }) => {
        if (since && (n.registered_at ?? "") < since) return false;
        if (type !== "all" && (n.notice_type || "기타") !== type) return false;
        if (org !== "all" && n.org !== org) return false;
        if (mine && !hit.length) return false;
        if (needle && ![n.title, n.org, n.api_names].join(" ").toLowerCase().includes(needle)) return false;
        return true;
      });
  }, [list, keywords, searchBody, q, type, org, period, mine]);

  const filtered = q || type !== "all" || org !== "all" || period !== "all" || mine;
  const reset = () => {
    setQ(""); setType("all"); setOrg("all"); setPeriod("all"); setMine(false);
  };

  return (
    <>
      <PageHeader title="공지 목록" description="수집한 공공데이터포털 API 공지사항이에요. 행을 누르면 자세히 볼 수 있어요." />

      <Card className="gap-0 py-0">
        <CardHeader className="gap-3 border-b py-4">
          <div className="flex flex-wrap items-center gap-2">
            <InputGroup className="min-w-[220px] flex-1">
              <InputGroupAddon><Search /></InputGroupAddon>
              <InputGroupInput placeholder="제목, 기관, API명 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="검색" />
            </InputGroup>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-[150px]" aria-label="유형"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 유형</SelectItem>
                {NOTICE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={org} onValueChange={setOrg}>
              <SelectTrigger className="w-[180px]" aria-label="기관"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 기관</SelectItem>
                {orgs.map(([o, c]) => (
                  <SelectItem key={o} value={o}>{o} <span className="text-muted-foreground">({c})</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <ToggleGroup type="single" variant="outline" size="sm" value={period} onValueChange={(v) => v && setPeriod(v as Period)} aria-label="기간">
              <ToggleGroupItem value="7">7일</ToggleGroupItem>
              <ToggleGroupItem value="30">30일</ToggleGroupItem>
              <ToggleGroupItem value="all">전체</ToggleGroupItem>
            </ToggleGroup>
            <div className="flex items-center gap-2">
              <Switch id="mine" checked={mine} onCheckedChange={setMine} disabled={!keywords.length} />
              <Label htmlFor="mine">내 키워드만</Label>
            </div>
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">
              {rows.length.toLocaleString()}건{filtered ? ` / 전체 ${list.length.toLocaleString()}건` : ""}
            </span>
            {filtered && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <FilterX /> 초기화
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {notices === null ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !rows.length ? (
            <p className="py-16 text-center text-sm text-muted-foreground">조건에 맞는 공지가 없어요.</p>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[110px] pl-4">공지일</TableHead>
                  <TableHead className="w-[150px]">유형</TableHead>
                  <TableHead>제목</TableHead>
                  <TableHead className="hidden w-[180px] pr-4 md:table-cell">기관</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, shown).map(({ n, hit }) => (
                  <TableRow key={n.notice_id} className="cursor-pointer" onClick={() => setOpen(n)}>
                    <TableCell className="pl-4 align-top tabular-nums text-muted-foreground">{n.registered_at ?? "-"}</TableCell>
                    <TableCell className="align-top"><TypeBadge type={n.notice_type} /></TableCell>
                    <TableCell className="max-w-0 whitespace-normal">
                      <div className="font-medium leading-snug">{n.title}</div>
                      {(hit.length > 0 || (n.api_names && n.api_names !== n.title)) && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {hit.length > 0 && <Kw list={hit} />}
                          {n.api_names && n.api_names !== n.title && <span className="truncate">{n.api_names}</span>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden pr-4 align-top text-muted-foreground md:table-cell">{n.org ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {rows.length > shown && (
          <CardFooter className="justify-center border-t py-3">
            <Button variant="outline" onClick={() => setShown((s) => s + PAGE)}>
              더 보기 <Badge variant="secondary">{(rows.length - shown).toLocaleString()}</Badge>
            </Button>
          </CardFooter>
        )}
      </Card>

      <NoticeSheet n={open} keywords={keywords} searchBody={searchBody} onClose={() => setOpen(null)} />
    </>
  );
}

function NoticeSheet({ n, keywords, searchBody, onClose }: { n: Notice | null; keywords: string[]; searchBody: boolean; onClose: () => void }) {
  const c = n ? classify(n.title, n.body ?? "") : null;
  const hit = n && keywords.length ? matchKeywords(n, keywords, searchBody) : [];
  return (
    <Sheet open={!!n} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        {n && c && (
          <>
            <SheetHeader className="border-b pr-12">
              <div><TypeBadge type={c.type} /></div>
              <SheetTitle className="text-lg leading-snug">{n.title}</SheetTitle>
              <SheetDescription>{n.org ?? "기관 미상"} · {n.registered_at ?? "-"}</SheetDescription>
            </SheetHeader>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-6 p-4">
                <dl className="grid grid-cols-[84px_1fr] gap-x-4 gap-y-3 text-sm">
                  <dt className="text-muted-foreground">API</dt><dd>{n.api_names || "-"}</dd>
                  <dt className="text-muted-foreground">영향</dt><dd>{c.impact}</dd>
                  <dt className="text-muted-foreground">조치</dt><dd className="font-medium">{c.action}</dd>
                  {c.newUrl && (
                    <>
                      <dt className="text-muted-foreground">신규 URL</dt>
                      <dd><a className="break-all text-primary underline underline-offset-4" href={c.newUrl} target="_blank" rel="noreferrer">{c.newUrl}</a></dd>
                    </>
                  )}
                  {hit.length > 0 && (<><dt className="text-muted-foreground">내 키워드</dt><dd><Kw list={hit} /></dd></>)}
                  <dt className="text-muted-foreground">수집</dt><dd className="tabular-nums text-muted-foreground">{fmtDateTime(n.crawled_at)}</dd>
                </dl>
                <Button asChild className="w-full sm:w-auto">
                  <a href={n.url} target="_blank" rel="noreferrer">공지 원문 보기 <ExternalLink /></a>
                </Button>
                {n.body && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">본문</h3>
                      <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-relaxed text-muted-foreground">{n.body}</p>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
