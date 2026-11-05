"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ArrowUpRight, CalendarDays, Database, MailCheck, Tags } from "lucide-react";
import { hasAnyRule, matchNotice, type AlertRule } from "@/lib/match";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Ctx, daysAgo, fmtShort, Kw, Notice, NOTICE_TYPES, PageHeader, SectionCard, StatCard, TypeBadge } from "./shared";
import type { NoticeFilter, Page } from "./AppShell";

const RANGE = 30;
const dailyConfig = { count: { label: "공지", color: "var(--primary)" } } satisfies ChartConfig;
const typeConfig = { count: { label: "공지", color: "var(--primary)" } } satisfies ChartConfig;

export default function Overview({
  ctx, notices, rule, go,
}: {
  ctx: Ctx; notices: Notice[] | null; rule: AlertRule; go: (p: Page, f?: NoticeFilter) => void;
}) {
  const [delivered, setDelivered] = useState<number | null>(null);

  useEffect(() => {
    ctx.supabase
      .from("gd_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.profile.user_id)
      .then(({ count }) => setDelivered(count ?? 0));
  }, [ctx.supabase, ctx.profile.user_id]);

  const list = notices ?? [];
  const since7 = daysAgo(7);
  const since30 = daysAgo(RANGE - 1);
  const recent30 = useMemo(() => list.filter((n) => (n.registered_at ?? "") >= since30), [list, since30]);
  const matched = useMemo(
    () => (hasAnyRule(rule) ? list.map((n) => ({ n, hit: matchNotice(n, rule) })).filter((x) => x.hit.length) : []),
    [list, rule],
  );

  const daily = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of recent30) if (n.registered_at) counts.set(n.registered_at, (counts.get(n.registered_at) ?? 0) + 1);
    return Array.from({ length: RANGE }, (_, i) => {
      const d = daysAgo(RANGE - 1 - i);
      const [, m, day] = d.split("-").map(Number);
      return { date: d, label: `${m}/${day}`, count: counts.get(d) ?? 0 };
    });
  }, [recent30]);

  const byType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of recent30) counts.set(n.notice_type || "기타", (counts.get(n.notice_type || "기타") ?? 0) + 1);
    return NOTICE_TYPES.map((t) => ({ type: t, count: counts.get(t) ?? 0 })).filter((d) => d.count).sort((a, b) => b.count - a.count);
  }, [recent30]);

  const lastCrawl = list.reduce<string | null>((m, n) => (!m || n.crawled_at > m ? n.crawled_at : m), null);
  const loading = notices === null;
  const hasRule = hasAnyRule(rule);
  const ruleDesc = [
    rule.keywords.length ? `키워드 ${rule.keywords.length}개` : "",
    rule.orgs.length ? `기관 ${rule.orgs.length}곳` : "",
    rule.types ? `유형 ${rule.types.length}개` : "",
  ].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader title="대시보드" description="공공데이터포털 API 공지 현황이에요. 매일 오후 2시에 새 공지를 모아 키워드에 맞는 공지를 메일로 보내요." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[118px] rounded-xl" />)
        ) : (
          <>
            <StatCard icon={Database} label="저장된 공지" value={list.length.toLocaleString()} hint={lastCrawl ? `마지막 수집 ${fmtShort(lastCrawl)}` : "아직 수집 전"} />
            <StatCard icon={CalendarDays} label="최근 7일 공지" value={list.filter((n) => (n.registered_at ?? "") >= since7).length} hint="공지일 기준" />
            <StatCard
              icon={Tags}
              label="내 알림에 걸린 공지"
              value={hasRule ? matched.length : "–"}
              hint={hasRule ? `${ruleDesc} 기준` : "키워드나 기관을 먼저 등록하세요"}
            />
            <StatCard icon={MailCheck} label="내가 받은 알림" value={delivered ?? "…"} hint="지금까지 메일로 받은 공지 수" />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="일별 공지 수" description={`최근 ${RANGE}일 · 공지일 기준`}>
          {loading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : (
            <ChartContainer config={dailyConfig} className="aspect-auto h-[240px] w-full">
              <BarChart data={daily} margin={{ left: -20, right: 4, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(_, p) => p?.[0]?.payload?.date} />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} maxBarSize={18} />
              </BarChart>
            </ChartContainer>
          )}
        </SectionCard>

        <SectionCard title="유형별 분포" description={`최근 ${RANGE}일 · 막대를 누르면 목록으로`}>
          {loading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : byType.length ? (
            <ChartContainer config={typeConfig} className="aspect-auto h-[240px] w-full">
              <BarChart data={byType} layout="vertical" margin={{ left: 0, right: 28 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="type" type="category" tickLine={false} axisLine={false} width={116} interval={0} tick={{ fontSize: 12 }} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
                <Bar
                  dataKey="count"
                  fill="var(--color-count)"
                  radius={4}
                  barSize={18}
                  className="cursor-pointer"
                  onClick={(d) => go("notices", { type: (d as unknown as { type: string }).type })}
                >
                  <LabelList dataKey="count" position="right" className="fill-foreground" fontSize={12} />
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">데이터가 없어요.</p>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="내 알림에 걸린 최근 공지"
        description={hasRule ? ruleDesc + " 기준" : undefined}
        action={
          hasRule ? (
            <Button variant="outline" size="sm" onClick={() => go("notices", { mine: true })}>
              전체 보기 <ArrowUpRight />
            </Button>
          ) : undefined
        }
      >
        {!hasRule ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Tags /></EmptyMedia>
              <EmptyTitle>아직 알림 조건이 없어요</EmptyTitle>
              <EmptyDescription>관심 있는 기관을 구독하거나 API 이름을 키워드로 등록하면 여기에 맞는 공지가 보여요.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => go("alerts")}>알림 설정하기</Button>
            </EmptyContent>
          </Empty>
        ) : !matched.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">아직 알림 조건에 걸린 공지가 없어요.</p>
        ) : (
          <ItemGroup>
            {matched.slice(0, 6).map(({ n, hit }, i) => (
              <div key={n.notice_id}>
                {i > 0 && <ItemSeparator />}
                <Item asChild>
                  <a href={n.url} target="_blank" rel="noreferrer">
                    <ItemContent>
                      <ItemTitle className="line-clamp-1">{n.title}</ItemTitle>
                      <ItemDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="tabular-nums">{n.registered_at}</span>
                        <span>·</span>
                        <span>{n.org ?? "기관 미상"}</span>
                        <Kw list={hit} />
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <TypeBadge type={n.notice_type} />
                    </ItemActions>
                  </a>
                </Item>
              </div>
            ))}
          </ItemGroup>
        )}
      </SectionCard>
    </>
  );
}
