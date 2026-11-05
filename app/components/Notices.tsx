"use client";

import { useEffect, useMemo, useState } from "react";
import { classify } from "@/lib/classify";
import { matchKeywords } from "@/lib/match";
import { daysAgo, fmtDateTime, Kw, Notice, NOTICE_TYPES, PageHead, TypeBadge } from "./ui";

type Period = "7" | "30" | "all";
const PAGE = 50;

export default function Notices({
  notices, keywords, searchBody, initial,
}: {
  notices: Notice[]; keywords: string[]; searchBody: boolean; initial: { type?: string; mine?: boolean };
}) {
  const [q, setQ] = useState("");
  const [type, setType] = useState(initial.type ?? "");
  const [org, setOrg] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [mine, setMine] = useState(!!initial.mine);
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<Notice | null>(null);

  useEffect(() => setShown(PAGE), [q, type, org, period, mine]);

  const orgs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notices) if (n.org) counts.set(n.org, (counts.get(n.org) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([o]) => o);
  }, [notices]);

  const rows = useMemo(() => {
    const since = period === "all" ? "" : daysAgo(Number(period));
    const needle = q.trim().toLowerCase();
    return notices
      .map((n) => ({ n, hit: keywords.length ? matchKeywords(n, keywords, searchBody) : [] }))
      .filter(({ n, hit }) => {
        if (since && (n.registered_at ?? "") < since) return false;
        if (type && (n.notice_type || "기타") !== type) return false;
        if (org && n.org !== org) return false;
        if (mine && !hit.length) return false;
        if (needle && ![n.title, n.org, n.api_names].join(" ").toLowerCase().includes(needle)) return false;
        return true;
      });
  }, [notices, keywords, searchBody, q, type, org, period, mine]);

  const reset = () => {
    setQ(""); setType(""); setOrg(""); setPeriod("all"); setMine(false);
  };
  const filtered = q || type || org || period !== "all" || mine;

  return (
    <>
      <PageHead title="공지 목록" desc="수집한 공공데이터포털 API 공지사항이에요. 행을 누르면 자세히 볼 수 있어요." />
      <section className="card">
        <div className="filters">
          <input type="search" placeholder="제목, 기관, API명 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="검색" />
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="유형">
            <option value="">모든 유형</option>
            {NOTICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={org} onChange={(e) => setOrg(e.target.value)} aria-label="기관" style={{ maxWidth: 200 }}>
            <option value="">모든 기관</option>
            {orgs.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <div className="seg" role="group" aria-label="기간">
            {([["7", "7일"], ["30", "30일"], ["all", "전체"]] as [Period, string][]).map(([v, l]) => (
              <button key={v} className={period === v ? "on" : ""} onClick={() => setPeriod(v)}>{l}</button>
            ))}
          </div>
          <label className="toggle">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} disabled={!keywords.length} />
            내 키워드만
          </label>
          {filtered && <button className="ghost sm" onClick={reset}>초기화</button>}
        </div>
        <div style={{ padding: "10px 18px", color: "var(--muted)", fontSize: 13 }}>
          {rows.length.toLocaleString()}건{filtered ? ` (전체 ${notices.length.toLocaleString()}건 중)` : ""}
        </div>
        {!rows.length ? (
          <div className="empty">조건에 맞는 공지가 없어요.</div>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 104 }}>공지일</th>
                  <th style={{ width: 120 }}>유형</th>
                  <th>제목</th>
                  <th className="hide-sm" style={{ width: 180 }}>기관</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, shown).map(({ n, hit }) => (
                  <tr key={n.notice_id} className="click" onClick={() => setOpen(n)}>
                    <td className="nowrap tnum">{n.registered_at ?? "-"}</td>
                    <td><TypeBadge type={n.notice_type} /></td>
                    <td>
                      <div className="title">{n.title}</div>
                      {(n.api_names || hit.length > 0) && (
                        <div className="sub">
                          {hit.length > 0 && <Kw list={hit} />}
                          {n.api_names && n.api_names !== n.title ? n.api_names : ""}
                        </div>
                      )}
                    </td>
                    <td className="hide-sm" style={{ color: "var(--text-2)" }}>{n.org ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > shown && (
          <div style={{ padding: 14, textAlign: "center", borderTop: "1px solid var(--line-2)" }}>
            <button onClick={() => setShown((s) => s + PAGE)}>더 보기 ({(rows.length - shown).toLocaleString()}건 남음)</button>
          </div>
        )}
      </section>
      {open && <NoticeDrawer n={open} keywords={keywords} searchBody={searchBody} onClose={() => setOpen(null)} />}
    </>
  );
}

function NoticeDrawer({ n, keywords, searchBody, onClose }: { n: Notice; keywords: string[]; searchBody: boolean; onClose: () => void }) {
  const c = classify(n.title, n.body ?? "");
  const hit = keywords.length ? matchKeywords(n, keywords, searchBody) : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="공지 상세">
        <div className="drawer-head">
          <h2>{n.title}</h2>
          <button className="ghost sm" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <div className="drawer-body">
          <dl className="kv">
            <dt>유형</dt><dd><TypeBadge type={c.type} /></dd>
            <dt>기관</dt><dd>{n.org ?? "-"}</dd>
            <dt>API</dt><dd>{n.api_names || "-"}</dd>
            <dt>공지일</dt><dd className="tnum">{n.registered_at ?? "-"}</dd>
            <dt>영향</dt><dd>{c.impact}</dd>
            <dt>조치</dt><dd>{c.action}</dd>
            {c.newUrl && (<><dt>신규 URL</dt><dd><a href={c.newUrl} target="_blank" rel="noreferrer">{c.newUrl}</a></dd></>)}
            {hit.length > 0 && (<><dt>내 키워드</dt><dd><Kw list={hit} /></dd></>)}
            <dt>수집</dt><dd className="tnum" style={{ color: "var(--muted)" }}>{fmtDateTime(n.crawled_at)}</dd>
          </dl>
          <a className="btn primary" href={n.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", height: 36, padding: "0 14px", borderRadius: 8, background: "var(--primary)", color: "#fff", alignItems: "center", textDecoration: "none", fontWeight: 500 }}>
            공지 원문 보기 ↗
          </a>
          {n.body && (
            <>
              <h3 style={{ fontSize: 14, margin: "24px 0 8px" }}>본문</h3>
              <div className="body-text">{n.body}</div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
