"use client";

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { LogOut, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

// 카카오처럼 이메일 없이 가입한 사용자에게 알림 받을 이메일을 6자리 코드로 인증받는 화면
export default function EmailVerify({ session, onDone, onLogout }: { session: Session; onDone: () => void; onLogout: () => void }) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const call = async (path: string, body: object) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/me/email/${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; email?: string };
      if (!r.ok) toast.error(j.error ?? `요청 실패 (${r.status})`);
      return r.ok ? j : null;
    } finally {
      setBusy(false);
    }
  };

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const j = await call("send-code", { email: sentTo ?? email });
    if (j?.email) {
      setSentTo(j.email);
      setCode("");
      toast.success("인증 코드를 보냈어요.");
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await call("verify", { code })) {
      toast.success("이메일이 인증됐어요.");
      onDone();
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Mail className="size-6" />
        </div>
        <CardTitle className="text-xl">알림 받을 이메일을 알려 주세요</CardTitle>
        <CardDescription>
          {sentTo ? (
            <><span className="font-medium text-foreground">{sentTo}</span>로 보낸 6자리 코드를 입력하세요.</>
          ) : (
            "카카오 계정에서 이메일을 받지 못했어요. 공지 알림을 받을 이메일을 인증해 주세요."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sentTo ? (
          <form onSubmit={verify} className="space-y-3">
            <Label htmlFor="verify-code">인증 코드</Label>
            <Input
              id="verify-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="h-11 text-center text-lg tracking-[0.5em] tabular-nums"
              autoFocus
            />
            <Button type="submit" size="lg" className="w-full" disabled={busy || code.length !== 6}>
              {busy && <Spinner />} 확인
            </Button>
            <div className="flex justify-between">
              <Button type="button" variant="link" size="sm" className="px-0" disabled={busy} onClick={() => send()}>코드 다시 보내기</Button>
              <Button type="button" variant="link" size="sm" className="px-0" disabled={busy} onClick={() => setSentTo(null)}>이메일 바꾸기</Button>
            </div>
          </form>
        ) : (
          <form onSubmit={send} className="space-y-3">
            <Label htmlFor="verify-email">이메일</Label>
            <Input id="verify-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" autoFocus />
            <Button type="submit" size="lg" className="w-full" disabled={busy || !email.trim()}>
              {busy && <Spinner />} 인증 코드 보내기
            </Button>
          </form>
        )}
      </CardContent>
      <Separator />
      <CardFooter className="justify-center">
        <Button variant="ghost" onClick={onLogout}><LogOut /> 로그아웃</Button>
      </CardFooter>
    </Card>
  );
}
