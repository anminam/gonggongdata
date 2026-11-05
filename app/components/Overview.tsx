"use client";

import { useEffect, useMemo, useState } from "react";
import { matchKeywords } from "@/lib/match";
import { Card, ColumnChart, Ctx, daysAgo, fmtShort, HBars, Kw, Notice, NOTICE_TYPES, PageHead, Stat, TypeBadge } from "./ui";

const RANGE = 30;

export default function Overview({
  ctx, notices, keywords, searchBody, go,
}: {
  ctx: Ctx; notices: Notice[]; keywords: string[]; searchBody: boolean;
  go: (page: "notices" | "alerts", filter?: { type?: string; mine?: boolean }) => void;
}) {
  const [delivered, setDelivered] = useState<number | null>(null);

  useEffect(() => {
    ctx.supabase
      .from("gd_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.profile.user_id)
      .then(({ count }) => setDelivered(count ?? 0));
  }, [ctx]);

  const since7 = daysAgo(7);
  const since30 = daysAgo(RANGE - 1);
  const recent30 = useMemo(() => notices.filter((n) => (n.registered_at ?? "") >= since30), [notices, since30]);

  const matched = useMemo(
    () =>
      keywords.length
        ? notices
            .map((n) => ({ n, hit: matchKeywords(n, keywords, searchBody) }))
            .filter((x) => x.hit.length > 0)
        : [],
    [notices, keywords, searchBody],
  );

  // 최근 30일 일별 공지 수
  const daily = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of recent30) if (n.registered_at) counts.set(n.registered_at, (counts.get(n.registered_at) ?? 0) + 1);
    return Array.from({ length: RANGE }, (_, i) => {
      const d = daysAgo(RANGE - 1 - i);
      const [, m, day] = d.split("-").map(Number);
      return { label: `${m}월 ${day}일`, value: counts.get(d) ?? 0, tick: i % 5 === 4 || i === RANGE - 1 ? `${m}/${day}` : undefined };
    });
  }, [recent30]);

  // 최근 30일 유형별 분포 (많은 순)
  const byType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of recent30) {
      const t = n.notice_type || "기타";
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return NOTICE_TYPES.map((t) => ({ label: t, value: counts.get(t) ?? 0 }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [recent30]);

  const lastCrawl = notices.reduce<string | null>((m, n) => (!m || n.crawled_at > m ? n.crawled_at : m), null);
  const recentMatched = matched.slice(0, 6);

  return (
    <>
      <PageHead
        title="대시보드"
        desc={`공공데이터포털 API 공지 현황이에요. 매일 오후 2시에 새 공지를 모아 키워드에 맞는 공지를 메일로 보내요.`}
      />

      <div className="grid cols-4">
        <Stat label="저장된 공지" value={notices.length.toLocaleString()} hint={lastCrawl ? `마지막 수집 ${fmtShort(lastCrawl)}` : "아직 수집 전"} />
        <Stat label="최근 7일 공지" value={notices.filter((n) => (n.registered_at ?? "") >= since7).length} hint="공지일 기준" />
        <Stat
          label="내 키워드에 걸린 공지"
          value={keywords.length ? matched.length : "–"}
          hint={keywords.length ? `키워드 ${keywords.length}개 기준` : "키워드를 먼저 등록하세요"}
        />
        <Stat label="내가 받은 알림" value={delivered ?? "…"} hint="지금까지 메일로 받은 공지 수" />
      </div>

      <div className="grid cols-3-1 mt">
        <Card title="일별 공지 수" sub={`최근 ${RANGE}일 · 공지일 기준`}>
          {recent30.length ? <ColumnChart data={daily} /> : <div className="empty">최근 {RANGE}일 공지가 없어요.</div>}
        </Card>
        <Card title="유형별 분포" sub={`최근 ${RANGE}일 · 누르면 목록으로`}>
          {byType.length ? (
            <HBars data={byType} onPick={(t) => go("notices", { type: t })} />
          ) : (
            <div className="empty">데이터가 없어요.</div>
          )}
        </Card>
      </div>

      <div className="mt">
        <Card
          title="내 키워드에 걸린 최근 공지"
          action={
            keywords.length ? (
              <button className="sm" onClick={() => go("notices", { mine: true })}>전체 보기</button>
            ) : (
              <button className="sm primary" onClick={() => go("alerts")}>키워드 등록하기</button>
            )
          }
          flush
        >
          {!keywords.length ? (
            <div className="empty">키워드를 등록하면 여기에 맞는 공지가 보여요.</div>
          ) : !recentMatched.length ? (
            <div className="empty">아직 키워드에 걸린 공지가 없어요.</div>
          ) : (
            <ul className="list">
              {recentMatched.map(({ n, hit }) => (
                <li key={n.notice_id}>
                  <div className="grow">
                    <a href={n.url} target="_blank" rel="noreferrer" className="title">{n.title}</a>
                    <div className="meta">
                      {n.registered_at} · {n.org ?? "기관 미상"} · <Kw list={hit} />
                    </div>
                  </div>
                  <TypeBadge type={n.notice_type} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
