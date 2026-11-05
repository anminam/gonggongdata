"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Bell, CalendarClock, Clock, LogOut, Mail, RefreshCw, Search, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { browserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import type { Profile } from "./components/shared";
import AppShell, { ThemeToggle } from "./components/AppShell";

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
        }).then((r) => (r.ok ? toast.success("Gmail 발송 계정이 연결됐어요.") : toast.error(`Gmail 연결 실패 (${r.status})`)));
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
      <Gate>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> 불러오는 중…
        </div>
      </Gate>
    );

  if (!session)
    return (
      <Gate>
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Bell className="size-6" />
            </div>
            <CardTitle className="text-xl">공공데이터 API 공지 알림</CardTitle>
            <CardDescription>공공데이터포털 API 공지사항을 매일 확인하고, 내 키워드에 걸린 공지만 메일로 보내드려요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Feature icon={Search} title="키워드로 걸러 받기" desc="기관명·API명·제목에서 키워드를 찾아요" />
            <Feature icon={CalendarClock} title="매일 오후 2시 자동 발송" desc="새 공지가 있을 때만 메일 1통으로 묶어서" />
            <Feature icon={Mail} title="유형별로 정리된 메일" desc="중단·URL 변경·점검을 한눈에" />
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <Button size="lg" className="w-full" onClick={login}>
              <GoogleIcon /> Google로 로그인
            </Button>
            <p className="text-center text-xs text-muted-foreground">처음 로그인하면 관리자 승인 후 이용할 수 있어요.</p>
          </CardFooter>
        </Card>
      </Gate>
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
    <main className="relative flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      {children}
    </main>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: typeof Bell; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background ring-1 ring-border">
        <Icon className="size-4" />
      </div>
      <div className="text-sm">
        <div className="font-medium">{title}</div>
        <div className="text-muted-foreground">{desc}</div>
      </div>
    </div>
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
