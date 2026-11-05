"use client";

import { useEffect, useMemo, useState } from "react";
import { Ctx, fmtDateTime, Kw, PageHead, Stat, TypeBadge } from "./ui";

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
  const [all, setAll] = useState(false);
  const [rows, setRows] = useState<Delivery[] | null>(null);
  const [emails, setEmails] = useState<Map<string, string>>(new Map());
  const [q, setQ] = useState("");

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
    supabase
      .from("gd_profiles")
      .select("user_id, email")
      .then(({ data }) => setEmails(new Map((data ?? []).map((p) => [p.user_id, p.email]))));
  }, [supabase, all]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!rows || !needle) return rows ?? [];
    return rows.filter((r) =>
      [r.gd_notices?.title, r.gd_notices?.org, r.matched_keywords.join(" "), (r.recipients ?? []).join(" "), emails.get(r.user_id)]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [rows, q, emails]);

  // 같은 실행(분 단위)에 나간 건은 메일 1통으로 묶여 있으므로 통 수를 따로 센다
  const mailCount = useMemo(() => new Set((rows ?? []).map((r) => `${r.user_id}|${r.sent_at.slice(0, 16)}`)).size, [rows]);
  const last = rows?.[0]?.sent_at;

  return (
    <>
      <PageHead
        title="발송 이력"
        desc="키워드에 걸려 메일로 보낸 공지 기록이에요. 테스트 메일은 기록되지 않아요."
        action={
          profile.is_admin ? (
            <div className="seg" role="group" aria-label="보기 범위">
              <button className={!all ? "on" : ""} onClick={() => setAll(false)}>내 이력</button>
              <button className={all ? "on" : ""} onClick={() => setAll(true)}>전체 사용자</button>
            </div>
          ) : undefined
        }
      />

      <div className="grid cols-4">
        <Stat label="보낸 공지" value={rows ? rows.length : "…"} hint="최근 500건 기준" />
        <Stat label="보낸 메일" value={rows ? mailCount : "…"} hint="같은 날 공지는 1통으로 묶어 보내요" />
        <Stat label="마지막 발송" value={last ? <span style={{ fontSize: 18 }}>{fmtDateTime(last)}</span> : "–"} />
        <Stat label="발송 시각" value={<span style={{ fontSize: 18 }}>매일 14:00</span>} hint="한국 시간" />
      </div>

      <section className="card mt">
        <div className="filters">
          <input type="search" placeholder="공지 제목, 키워드, 수신 주소 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="검색" />
        </div>
        {rows === null ? (
          <div className="empty">불러오는 중…</div>
        ) : !filtered.length ? (
          <div className="empty">{rows.length ? "검색 결과가 없어요." : "아직 발송된 알림이 없어요."}</div>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 150 }}>발송 시각</th>
                  <th>공지</th>
                  <th style={{ width: 160 }}>매칭 키워드</th>
                  <th className="hide-sm" style={{ width: 200 }}>{all ? "사용자 · 수신처" : "수신처"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap tnum">{fmtDateTime(r.sent_at)}</td>
                    <td>
                      {r.gd_notices ? (
                        <a href={r.gd_notices.url} target="_blank" rel="noreferrer" className="title">{r.gd_notices.title}</a>
                      ) : (
                        <span className="title">{r.notice_id}</span>
                      )}
                      <div className="sub" style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                        <TypeBadge type={r.gd_notices?.notice_type ?? null} /> {r.gd_notices?.org}
                      </div>
                    </td>
                    <td><Kw list={r.matched_keywords} /></td>
                    <td className="hide-sm" style={{ color: "var(--text-2)", fontSize: 13 }}>
                      {all && <div style={{ fontWeight: 500, color: "var(--text)" }}>{emails.get(r.user_id) ?? "알 수 없음"}</div>}
                      {(r.recipients ?? []).join(", ") || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
