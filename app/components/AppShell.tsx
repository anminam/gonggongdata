"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { browserClient } from "@/lib/supabase";
import type { Notice, Profile } from "./ui";
import Overview from "./Overview";
import Notices from "./Notices";
import Alerts, { type Item } from "./Alerts";
import History from "./History";
import Admin from "./Admin";

type Page = "overview" | "notices" | "alerts" | "history" | "admin";

const NAV: { id: Page; label: string; ico: string; admin?: boolean }[] = [
  { id: "overview", label: "대시보드", ico: "▦" },
  { id: "notices", label: "공지 목록", ico: "☰" },
  { id: "alerts", label: "알림 설정", ico: "✦" },
  { id: "history", label: "발송 이력", ico: "✉" },
  { id: "admin", label: "관리자", ico: "⚙", admin: true },
];

export default function AppShell({ supabase, session, profile, onLogout }: { supabase: ReturnType<typeof browserClient>; session: Session; profile: Profile; onLogout: () => void }) {
  const [page, setPage] = useState<Page>("overview");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [keywords, setKeywords] = useState<Item[]>([]);
  const [searchBody, setSearchBody] = useState(false);
  // 공지 목록으로 넘어갈 때 걸어 둘 필터 (대시보드에서 유형/키워드를 누른 경우)
  const [noticeFilter, setNoticeFilter] = useState<{ type?: string; mine?: boolean }>({});

  const loadNotices = useCallback(async () => {
    const { data } = await supabase
      .from("gd_notices")
      .select("notice_id, org, title, api_names, registered_at, body, notice_type, url, crawled_at")
      .order("registered_at", { ascending: false })
      .order("crawled_at", { ascending: false })
      .limit(1000);
    setNotices((data ?? []) as Notice[]);
  }, [supabase]);

  const loadMine = useCallback(async () => {
    const [k, s] = await Promise.all([
      supabase.from("gd_keywords").select("id, keyword").eq("user_id", profile.user_id).order("id"),
      supabase.from("gd_user_settings").select("search_body").eq("user_id", profile.user_id).maybeSingle(),
    ]);
    setKeywords((k.data ?? []).map((x) => ({ id: x.id, value: x.keyword })));
    setSearchBody(!!s.data?.search_body);
  }, [supabase, profile.user_id]);

  useEffect(() => {
    loadNotices();
    loadMine();
  }, [loadNotices, loadMine]);

  const ctx = { supabase, session, profile };
  const kw = keywords.map((k) => k.value);
  const go = (p: Page, filter: { type?: string; mine?: boolean } = {}) => {
    setNoticeFilter(filter);
    setPage(p);
    window.scrollTo(0, 0);
  };

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <span className="logo">공</span>
          <strong>공공데이터<br />API 공지 알림</strong>
        </div>
        <nav className="nav">
          {NAV.filter((n) => !n.admin || profile.is_admin).map((n) => (
            <button key={n.id} className={page === n.id ? "on" : ""} onClick={() => go(n.id)}>
              <span className="ico" aria-hidden>{n.ico}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <div className="email">{profile.email}</div>
          <button className="ghost sm" onClick={onLogout}>로그아웃</button>
        </div>
      </aside>
      <main className="main">
        <div className="content">
          {page === "overview" && <Overview ctx={ctx} notices={notices} keywords={kw} searchBody={searchBody} go={go} />}
          {page === "notices" && (
            <Notices notices={notices} keywords={kw} searchBody={searchBody} initial={noticeFilter} />
          )}
          {page === "alerts" && (
            <Alerts ctx={ctx} notices={notices} keywords={keywords} searchBody={searchBody} reload={loadMine} />
          )}
          {page === "history" && <History ctx={ctx} />}
          {page === "admin" && profile.is_admin && <Admin ctx={ctx} onCrawled={loadNotices} />}
        </div>
      </main>
    </div>
  );
}
