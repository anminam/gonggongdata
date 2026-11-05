"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { browserClient } from "@/lib/supabase";
import type { Profile } from "./components/ui";
import AppShell from "./components/AppShell";

export default function Home() {
  const supabase = useMemo(() => browserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // 관리자가 'Gmail 발송 계정 연결'로 돌아온 직후: 갱신 토큰을 서버에 저장
      if (event === "SIGNED_IN" && s?.provider_refresh_token && localStorage.getItem("gd_gmail_connect")) {
        localStorage.removeItem("gd_gmail_connect");
        fetch("/api/admin/gmail", {
          method: "POST",
          headers: { Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: s.provider_refresh_token }),
        }).then((r) => alert(r.ok ? "Gmail 발송 계정이 연결됐어요." : `Gmail 연결 실패 (${r.status})`));
      }
    });
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

  const login = () => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  const logout = () => supabase.auth.signOut();

  if (loading)
    return (
      <main className="gate">
        <p style={{ color: "var(--muted)" }}>불러오는 중…</p>
      </main>
    );

  if (!session)
    return (
      <main className="gate">
        <div className="gate-card">
          <span className="logo">공</span>
          <h1>공공데이터 API 공지 알림</h1>
          <p>공공데이터포털 API 공지사항 중 내 키워드에 해당하는 공지를 매일 오후 2시에 메일로 보내드려요.</p>
          <div className="actions">
            <button className="primary" onClick={login}>Google로 로그인</button>
          </div>
        </div>
      </main>
    );

  if (!profile || profile.status !== "approved")
    return (
      <main className="gate">
        <div className="gate-card">
          <span className="logo">공</span>
          <h1>{profile?.status === "rejected" ? "승인이 거절되었어요" : "관리자 승인 대기 중"}</h1>
          <p>{session.user.email} 계정으로 가입 요청이 접수됐어요. 관리자가 승인하면 이용할 수 있어요.</p>
          <div className="actions">
            <button onClick={loadProfile}>새로고침</button>
            <button onClick={logout}>로그아웃</button>
          </div>
        </div>
      </main>
    );

  return <AppShell supabase={supabase} session={session} profile={profile} onLogout={logout} />;
}
