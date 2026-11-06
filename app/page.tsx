"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Bell, Clock, Info, LogOut, RefreshCw, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { browserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import type { Profile } from "./components/shared";
import AppShell, { ThemeToggle } from "./components/AppShell";

export default function Home() {
  const supabase = useMemo(() => browserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  // 로그인 정보를 처음 읽어 왔는지. 읽기 전에는 로그인 화면/승인 대기 화면을 그리지 않는다
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  // 프로필을 읽는 중이거나 실패했을 때 '승인 대기'로 잘못 보이지 않도록 상태를 따로 둔다
  const [profileState, setProfileState] = useState<"idle" | "loading" | "ok" | "error">("idle");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // 관리자가 'Gmail 발송 계정 연결'로 돌아온 직후: 갱신 토큰을 서버에 저장
      if (event === "SIGNED_IN" && s?.provider_refresh_token && localStorage.getItem("gd_gmail_connect")) {
        localStorage.removeItem("gd_gmail_connect");
        fetch("/api/admin/gmail", {
          method: "POST",
          headers: { Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: s.provider_refresh_token }),
        }).then((r) => (r.ok ? toast.success("Gmail 발송 계정이 연결됐어요.") : toast.error(`Gmail 연결 실패 (${r.status})`)));
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // 토큰이 갱신될 때마다 session 객체가 바뀌므로, 사용자가 바뀔 때만 프로필을 다시 읽는다
  const userId = session?.user.id ?? null;
  const userEmail = session?.user.email ?? "";

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setProfileState("idle");
      return;
    }
    setProfileState("loading");
    const read = () => supabase.from("gd_profiles").select("*").eq("user_id", userId).maybeSingle();
    let { data, error } = await read();
    if (!error && !data) {
      // 처음 로그인한 사용자: 프로필 생성 (이미 있으면 중복 오류는 무시)
      await supabase.from("gd_profiles").insert({ user_id: userId, email: userEmail });
      ({ data, error } = await read());
    }
    if (!error && !data) {
      // 토큰이 막 바뀌는 순간이면 빈 결과가 올 수 있어 토큰을 새로 받아 한 번 더 읽는다
      await supabase.auth.refreshSession();
      ({ data, error } = await read());
    }
    if (error || !data) {
      setProfileState("error");
      return;
    }
    setProfile(data as Profile);
    setProfileState("ok");
  }, [userId, userEmail, supabase]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const login = () => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  const logout = () => supabase.auth.signOut();

  if (profileState === "error")
    return (
      <Gate>
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <CardTitle className="text-xl">프로필을 불러오지 못했어요</CardTitle>
            <CardDescription>잠시 후 다시 시도해 주세요. 계속되면 로그아웃했다가 다시 로그인해 주세요.</CardDescription>
          </CardHeader>
          <Separator />
          <CardFooter className="justify-center gap-2">
            <Button variant="outline" onClick={loadProfile}><RefreshCw /> 다시 시도</Button>
            <Button variant="ghost" onClick={logout}><LogOut /> 로그아웃</Button>
          </CardFooter>
        </Card>
      </Gate>
    );

  if (!authReady || (session && profileState !== "ok"))
    return (
      <Gate>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> 불러오는 중…
        </div>
      </Gate>
    );

  if (!session)
    return (
      <main className="relative flex min-h-svh flex-wrap bg-background">
        <div className="absolute top-4 right-4"><ThemeToggle /></div>
        <section className="flex min-w-0 flex-[1_1_560px] flex-col gap-12 border-r bg-card px-6 py-10 md:px-16">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Bell className="size-4" />
            </div>
            <span className="font-bold tracking-tight">공공데이터 알림</span>
          </div>
          <div className="mt-auto max-w-xl space-y-5">
            <p className="text-sm font-semibold tracking-widest text-secondary-foreground">API 공지 모니터링</p>
            <h1 className="font-heading text-4xl leading-tight md:text-5xl">
              공공데이터포털 공지,
              <br />
              이제 놓치지 마세요.
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              쓰고 있는 API가 중단되거나 URL이 바뀌면 메일로 먼저 알려드려요. 키워드와 기관만 등록해 두면 됩니다.
            </p>
          </div>
          <ol className="mb-auto grid max-w-3xl grid-cols-1 border-t sm:grid-cols-3">
            <Feature n="01" title="키워드로 걸러 받기" desc="기관명·API명·제목에서 키워드를 찾아요" />
            <Feature n="02" title="매일 오후 2시 발송" desc="새 공지가 있을 때만 메일 1통으로 묶어서" />
            <Feature n="03" title="유형별로 정리" desc="중단·URL 변경·점검을 한눈에" />
          </ol>
        </section>
        <section className="flex min-w-0 flex-[1_1_420px] items-center justify-center px-6 py-10">
          <div className="w-full max-w-sm space-y-7">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">시작하기</h2>
              <p className="text-sm text-muted-foreground">Google 계정으로 로그인하세요.</p>
            </div>
            <Button size="lg" className="h-13 w-full text-base" onClick={login}>
              <GoogleIcon /> Google로 로그인
            </Button>
            <div className="flex gap-3 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              처음 로그인하면 관리자 승인 후 이용할 수 있어요.
            </div>
          </div>
        </section>
      </main>
    );

  if (!profile || profile.status !== "approved") {
    const rejected = profile?.status === "rejected";
    return (
      <Gate>
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              {rejected ? <ShieldX className="size-6" /> : <Clock className="size-6" />}
            </div>
            <CardTitle className="text-xl">{rejected ? "승인이 거절되었어요" : "관리자 승인 대기 중"}</CardTitle>
            <CardDescription>
              <span className="font-medium text-foreground">{session.user.email}</span> 계정으로 가입 요청이 접수됐어요.
              {rejected ? " 관리자에게 문의해 주세요." : " 관리자가 승인하면 바로 이용할 수 있어요."}
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardFooter className="justify-center gap-2">
            <Button variant="outline" onClick={loadProfile}><RefreshCw /> 새로고침</Button>
            <Button variant="ghost" onClick={logout}><LogOut /> 로그아웃</Button>
          </CardFooter>
        </Card>
      </Gate>
    );
  }

  return <AppShell supabase={supabase} session={session} profile={profile} onLogout={logout} />;
}

function Gate({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-svh items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      {children}
    </main>
  );
}

function Feature({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <li className="space-y-1.5 py-5 sm:px-5 sm:first:pl-0 sm:last:pr-0 sm:[&+&]:border-l">
      <div className="text-xs text-muted-foreground tabular-nums">{n}</div>
      <div className="font-semibold">{title}</div>
      <div className="text-sm leading-relaxed text-muted-foreground">{desc}</div>
    </li>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}
