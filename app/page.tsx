"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { browserClient } from "@/lib/supabase";

type Profile = { user_id: string; email: string; status: "pending" | "approved" | "rejected"; is_admin: boolean; created_at: string };
type Item = { id: number; value: string };
type Delivery = { id: number; notice_id: string; matched_keywords: string[]; sent_at: string; gd_notices: { title: string; url: string } | null };
type RunLog = { id: number; started_at: string; status: string; new_notices: number; emails_sent: number; error: string | null };

const fmt = (s: string) => new Date(s).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

export default function Home() {
  const supabase = useMemo(() => browserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const loadProfile = useCallback(async () => {
    if (!session) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const uid = session.user.id;
    let { data } = await supabase.from("gd_profiles").select("*").eq("user_id", uid).maybeSingle();
    if (!data) {
      await supabase.from("gd_profiles").insert({ user_id: uid, email: session.user.email ?? "" });
      ({ data } = await supabase.from("gd_profiles").select("*").eq("user_id", uid).maybeSingle());
    }
    setProfile(data as Profile);
    setLoading(false);
  }, [session, supabase]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const login = () =>
    supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  const logout = () => supabase.auth.signOut();

  if (loading) return <main className="center">불러오는 중…</main>;

  if (!session)
    return (
      <main className="center">
        <h1>공공데이터 API 공지 알림</h1>
        <p className="muted">공공데이터포털 API 공지사항 중 내 키워드에 해당하는 공지를 매일 오후 2시에 메일로 보내드려요.</p>
        <button className="primary" onClick={login}>Google로 로그인</button>
      </main>
    );

  if (!profile || profile.status !== "approved")
    return (
      <main className="center">
        <h1>{profile?.status === "rejected" ? "승인이 거절되었습니다" : "관리자 승인 대기 중"}</h1>
        <p className="muted">{session.user.email} 계정으로 가입 요청이 접수되었습니다. 관리자가 승인하면 이용할 수 있어요.</p>
        <div className="row">
          <button onClick={loadProfile}>새로고침</button>
          <button onClick={logout}>로그아웃</button>
        </div>
      </main>
    );

  return <Dashboard session={session} profile={profile} onLogout={logout} />;
}

function Dashboard({ session, profile, onLogout }: { session: Session; profile: Profile; onLogout: () => void }) {
  const supabase = useMemo(() => browserClient(), []);
  const [tab, setTab] = useState<"settings" | "history" | "admin">("settings");
  return (
    <main className="wrap">
      <header className="top">
        <strong>공공데이터 API 공지 알림</strong>
        <span className="muted small">{profile.email}</span>
        <button className="link" onClick={onLogout}>로그아웃</button>
      </header>
      <nav className="tabs">
        <button className={tab === "settings" ? "on" : ""} onClick={() => setTab("settings")}>내 설정</button>
        <button className={tab === "history" ? "on" : ""} onClick={() => setTab("history")}>발송 이력</button>
        {profile.is_admin && (
          <button className={tab === "admin" ? "on" : ""} onClick={() => setTab("admin")}>관리자</button>
        )}
      </nav>
      {tab === "settings" && <Settings supabase={supabase} session={session} />}
      {tab === "history" && <History supabase={supabase} uid={profile.user_id} />}
      {tab === "admin" && profile.is_admin && <Admin supabase={supabase} session={session} />}
    </main>
  );
}

type SB = ReturnType<typeof browserClient>;

function ListEditor({
  title, hint, placeholder, items, onAdd, onRemove, validate,
}: {
  title: string; hint: string; placeholder: string; items: Item[];
  onAdd: (v: string) => Promise<string | null>; onRemove: (id: number) => void; validate?: (v: string) => string | null;
}) {
  const [v, setV] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const add = async () => {
    const val = v.trim();
    if (!val) return;
    const e = validate?.(val) ?? (await onAdd(val));
    setErr(e);
    if (!e) setV("");
  };
  return (
    <section className="card">
      <h2>{title}</h2>
      <p className="muted small">{hint}</p>
      <div className="row">
        <input value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="primary" onClick={add}>추가</button>
      </div>
      {err && <p className="error">{err}</p>}
      <ul className="chips">
        {items.map((i) => (
          <li key={i.id}>
            {i.value}
            <button aria-label="삭제" onClick={() => onRemove(i.id)}>×</button>
          </li>
        ))}
        {!items.length && <li className="empty">아직 없어요</li>}
      </ul>
    </section>
  );
}

function Settings({ supabase, session }: { supabase: SB; session: Session }) {
  const uid = session.user.id;
  const [keywords, setKeywords] = useState<Item[]>([]);
  const [recipients, setRecipients] = useState<Item[]>([]);
  const [searchBody, setSearchBody] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [k, r, s] = await Promise.all([
      supabase.from("gd_keywords").select("id, keyword").order("id"),
      supabase.from("gd_recipients").select("id, email").order("id"),
      supabase.from("gd_user_settings").select("*").maybeSingle(),
    ]);
    setKeywords((k.data ?? []).map((x) => ({ id: x.id, value: x.keyword })));
    setRecipients((r.data ?? []).map((x) => ({ id: x.id, value: x.email })));
    if (s.data) {
      setSearchBody(s.data.search_body);
      setEnabled(s.data.enabled);
    }
  }, [supabase]);
  useEffect(() => {
    load();
  }, [load]);

  const saveSetting = async (patch: { search_body?: boolean; enabled?: boolean }) => {
    await supabase.from("gd_user_settings").upsert({ user_id: uid, ...patch, updated_at: new Date().toISOString() });
  };

  const testSend = async () => {
    setMsg("발송 중…");
    const res = await fetch("/api/me/test-send", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
    const j = await res.json().catch(() => ({}));
    setMsg(j.ok ? `테스트 메일을 ${j.recipients.length}곳에 보냈어요 (${j.count}건). 스팸함도 확인해주세요.` : `실패: ${j.error ?? res.status}`);
  };

  return (
    <>
      <ListEditor
        title="키워드"
        hint="하나라도 포함되면 알림 (OR 조건). 제목·API명·기관명에서 찾아요."
        placeholder="예: 국토교통부, 항공, 기상청"
        items={keywords}
        onAdd={async (v) => {
          const { error } = await supabase.from("gd_keywords").insert({ user_id: uid, keyword: v });
          if (error) return error.code === "23505" ? "이미 있는 키워드예요" : error.message;
          load();
          return null;
        }}
        onRemove={async (id) => {
          await supabase.from("gd_keywords").delete().eq("id", id);
          load();
        }}
      />
      <ListEditor
        title="수신 메일주소"
        hint="키워드에 해당하는 새 공지가 있을 때만 매일 오후 2시에 보내요."
        placeholder="name@samsung.com"
        items={recipients}
        validate={(v) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? null : "메일주소 형식이 아니에요")}
        onAdd={async (v) => {
          const { error } = await supabase.from("gd_recipients").insert({ user_id: uid, email: v });
          if (error) return error.code === "23505" ? "이미 있는 주소예요" : error.message;
          load();
          return null;
        }}
        onRemove={async (id) => {
          await supabase.from("gd_recipients").delete().eq("id", id);
          load();
        }}
      />
      <section className="card">
        <h2>옵션</h2>
        <label className="check">
          <input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); saveSetting({ enabled: e.target.checked }); }} />
          알림 받기
        </label>
        <label className="check">
          <input type="checkbox" checked={searchBody} onChange={(e) => { setSearchBody(e.target.checked); saveSetting({ search_body: e.target.checked }); }} />
          공지 본문까지 키워드 검사 (더 많이 잡히지만 관련 없는 공지도 섞일 수 있어요)
        </label>
        <div className="row">
          <button onClick={testSend}>테스트 메일 보내기</button>
        </div>
        {msg && <p className="muted small">{msg}</p>}
      </section>
    </>
  );
}

function History({ supabase, uid }: { supabase: SB; uid: string }) {
  const [rows, setRows] = useState<Delivery[]>([]);
  useEffect(() => {
    supabase
      .from("gd_deliveries")
      .select("id, notice_id, matched_keywords, sent_at, gd_notices(title, url)")
      .eq("user_id", uid)
      .order("sent_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setRows((data ?? []) as unknown as Delivery[]));
  }, [supabase, uid]);
  return (
    <section className="card">
      <h2>발송 이력</h2>
      {!rows.length && <p className="muted">아직 발송된 알림이 없어요.</p>}
      <ul className="list">
        {rows.map((r) => (
          <li key={r.id}>
            <a href={r.gd_notices?.url} target="_blank" rel="noreferrer">{r.gd_notices?.title ?? r.notice_id}</a>
            <span className="muted small">{fmt(r.sent_at)} · {r.matched_keywords.join(", ")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Admin({ supabase, session }: { supabase: SB; session: Session }) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [u, l] = await Promise.all([
      supabase.from("gd_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("gd_run_logs").select("*").order("started_at", { ascending: false }).limit(10),
    ]);
    setUsers((u.data ?? []) as Profile[]);
    setLogs((l.data ?? []) as RunLog[]);
  }, [supabase]);
  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, status: Profile["status"]) => {
    await supabase
      .from("gd_profiles")
      .update({ status, approved_at: status === "approved" ? new Date().toISOString() : null })
      .eq("user_id", id);
    load();
  };

  const runNow = async () => {
    setMsg("실행 중… (최대 1분)");
    const res = await fetch("/api/admin/run", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
    const j = await res.json().catch(() => ({}));
    setMsg(j.ok ? `완료: 신규 공지 ${j.newNotices}건, 메일 ${j.emailsSent}통` : `실패: ${j.error ?? res.status}`);
    load();
  };

  const pending = users.filter((u) => u.status === "pending");
  return (
    <>
      <section className="card">
        <h2>승인 대기 ({pending.length})</h2>
        {!pending.length && <p className="muted">대기 중인 요청이 없어요.</p>}
        <ul className="list">
          {pending.map((u) => (
            <li key={u.user_id} className="between">
              <span>{u.email} <span className="muted small">{fmt(u.created_at)}</span></span>
              <span className="row">
                <button className="primary" onClick={() => setStatus(u.user_id, "approved")}>수락</button>
                <button onClick={() => setStatus(u.user_id, "rejected")}>거절</button>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2>전체 사용자</h2>
        <ul className="list">
          {users.filter((u) => u.status !== "pending").map((u) => (
            <li key={u.user_id} className="between">
              <span>{u.email} {u.is_admin && <em className="badge">관리자</em>}</span>
              {!u.is_admin && (
                <span className="row">
                  <span className="muted small">{u.status === "approved" ? "승인됨" : "거절됨"}</span>
                  {u.status === "approved"
                    ? <button onClick={() => setStatus(u.user_id, "rejected")}>차단</button>
                    : <button onClick={() => setStatus(u.user_id, "approved")}>승인</button>}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2>실행 기록</h2>
        <div className="row"><button className="primary" onClick={runNow}>지금 크롤링 실행</button></div>
        {msg && <p className="muted small">{msg}</p>}
        <ul className="list">
          {logs.map((l) => (
            <li key={l.id}>
              <span>{fmt(l.started_at)} · <b className={l.status === "error" ? "error" : ""}>{l.status}</b> · 신규 {l.new_notices} · 메일 {l.emails_sent}</span>
              {l.error && <span className="error small">{l.error}</span>}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
